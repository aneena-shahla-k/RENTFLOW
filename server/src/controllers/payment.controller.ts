import crypto from 'crypto';
import { Response } from 'express';
import { isRazorpayConfigured } from '../config/env.js';
import { Booking } from '../models/Booking.js';
import { BookingItem } from '../models/BookingItem.js';
import { Company } from '../models/Company.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { logActivity } from '../services/activity.service.js';
import { ensureInvoiceForBooking, generateInvoicePdfBuffer } from '../services/invoice.service.js';
import { notifyCompanyAdmins, notifyUser } from '../services/notification.service.js';
import { computeDevSimulatorSignature, getPaymentGateway } from '../services/payment.service.js';
import { AuthRequest } from '../types/index.js';
import { AppError } from '../utils/errors.js';

export async function createPaymentOrder(req: AuthRequest, res: Response): Promise<void> {
  const { bookingId } = req.body;
  if (!bookingId) {
    throw new AppError('bookingId is required.', 400, 'BOOKING_ID_REQUIRED');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
  }

  if (
    req.user?.role === 'customer' &&
    booking.customerId.toString() !== req.user._id.toString()
  ) {
    throw new AppError('You cannot pay for another customer’s booking.', 403, 'FORBIDDEN');
  }

  if (booking.paymentStatus === 'paid') {
    throw new AppError('This booking has already been paid.', 400, 'ALREADY_PAID');
  }
  if (['cancelled', 'rejected'].includes(booking.status)) {
    throw new AppError('Cancelled or rejected bookings cannot be paid.', 400, 'INVALID_STATUS');
  }

  const company = await Company.findById(booking.companyId);
  const currency = company?.settings?.currency || 'INR';
  const gateway = getPaymentGateway();
  const receipt = `RCPT-${booking.bookingReference}`;

  const order = await gateway.createOrder({
    amountInSmallestUnit: booking.pricing.totalAmount,
    currency,
    receipt,
    notes: {
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      companyId: booking.companyId.toString(),
    },
  });

  const payment = await Payment.create({
    companyId: booking.companyId,
    bookingId: booking._id,
    customerId: booking.customerId,
    gateway: order.gateway,
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency,
    status: 'created',
    receipt,
  });

  if (booking.status === 'hold' || booking.status === 'pending' || booking.status === 'confirmed') {
    booking.paymentStatus = 'pending';
    if (booking.status === 'hold') {
      booking.status = 'payment_pending';
      booking.holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    }
    await booking.save();
  }

  res.status(201).json({
    success: true,
    data: {
      paymentIdRecord: payment._id,
      gateway: order.gateway,
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
      isSimulated: order.isSimulated,
      bookingReference: booking.bookingReference,
    },
  });
}

/**
 * Only available when Razorpay live/test keys are NOT configured,
 * enabling the clearly labelled Development Payment Simulator UI to test real HMAC verification.
 */
export async function generateDevSimulatedPaymentPayload(
  req: AuthRequest,
  res: Response
): Promise<void> {
  if (isRazorpayConfigured) {
    throw new AppError(
      'Development simulator is disabled when Razorpay credentials are configured.',
      403,
      'SIMULATOR_DISABLED'
    );
  }

  const { orderId } = req.body;
  const payment = await Payment.findOne({ orderId });
  if (!payment) {
    throw new AppError('Payment order not found.', 404, 'ORDER_NOT_FOUND');
  }
  if (
    req.user?.role === 'customer' &&
    payment.customerId.toString() !== req.user._id.toString()
  ) {
    throw new AppError('Forbidden.', 403, 'FORBIDDEN');
  }

  const paymentId = `pay_sim_${crypto.randomBytes(6).toString('hex')}`;
  const signature = computeDevSimulatorSignature(orderId, paymentId);

  res.json({
    success: true,
    data: {
      orderId,
      paymentId,
      signature,
      mode: 'DEVELOPMENT_SIMULATOR',
    },
  });
}

async function finalizeCapturedPayment(
  payment: InstanceType<typeof Payment>,
  paymentId: string,
  signature: string,
  actor?: { id: string; name: string; role: string },
  ip?: string
) {
  payment.paymentId = paymentId;
  payment.signature = signature;
  payment.status = 'captured';
  payment.paidAt = new Date();
  await payment.save();

  const booking = await Booking.findById(payment.bookingId);
  if (booking) {
    booking.paymentStatus = 'paid';
    booking.holdExpiresAt = undefined;
    if (['hold', 'pending', 'confirmed', 'payment_pending'].includes(booking.status)) {
      booking.status = 'paid';
    }
    booking.statusHistory.push({
      status: booking.status,
      note: `Payment verified (${payment.gateway}: ${paymentId})`,
      changedBy: actor ? (actor.id as unknown as typeof booking.customerId) : booking.customerId,
      changedByName: actor?.name || 'Payment Gateway',
      changedAt: new Date(),
    });
    await booking.save();

    const invoice = await ensureInvoiceForBooking(booking, payment._id.toString());

    await Promise.all([
      notifyUser({
        userId: booking.customerId,
        companyId: booking.companyId,
        type: 'PAYMENT_SUCCESS',
        title: `Payment Confirmed — ${booking.bookingReference}`,
        message: `Payment of ${invoice.currencySymbol}${(payment.amount / 100).toFixed(2)} received. Invoice ${invoice.invoiceNumber} is ready.`,
        link: `/customer/bookings/${booking._id}`,
        sendEmailNotification: true,
      }),
      notifyCompanyAdmins({
        companyId: booking.companyId,
        type: 'PAYMENT_RECEIVED',
        title: `Payment Received — ${booking.bookingReference}`,
        message: `Payment verified for booking ${booking.bookingReference}.`,
        link: `/admin/bookings/${booking._id}`,
      }),
      logActivity({
        companyId: booking.companyId,
        actorId: actor?.id,
        actorName: actor?.name || 'System',
        actorRole: actor?.role || 'system',
        action: 'PAYMENT_VERIFIED',
        resourceType: 'Payment',
        resourceId: payment._id.toString(),
        description: `Verified payment ${paymentId} for booking ${booking.bookingReference}`,
        ipAddress: ip,
      }),
    ]);

    return { booking, invoice };
  }

  return { booking: null, invoice: null };
}

export async function verifyPayment(req: AuthRequest, res: Response): Promise<void> {
  const { orderId, paymentId, signature } = req.body;
  if (!orderId || !paymentId || !signature) {
    throw new AppError(
      'orderId, paymentId, and signature are required for verification.',
      400,
      'MISSING_PAYMENT_FIELDS'
    );
  }

  const payment = await Payment.findOne({ orderId });
  if (!payment) {
    throw new AppError('Payment order not found.', 404, 'ORDER_NOT_FOUND');
  }

  if (
    req.user?.role === 'customer' &&
    payment.customerId.toString() !== req.user._id.toString()
  ) {
    throw new AppError('Forbidden.', 403, 'FORBIDDEN');
  }

  // Idempotent handling of duplicate verification callbacks
  if (payment.status === 'captured') {
    const [booking, invoice] = await Promise.all([
      Booking.findById(payment.bookingId),
      Invoice.findOne({ bookingId: payment.bookingId }),
    ]);
    res.json({
      success: true,
      message: 'Payment already verified.',
      data: { alreadyProcessed: true, payment, booking, invoice },
    });
    return;
  }

  const gateway = getPaymentGateway();
  const isValid = gateway.verifySignature({ orderId, paymentId, signature });

  if (!isValid) {
    payment.status = 'failed';
    payment.failureReason = 'HMAC signature verification failed';
    await payment.save();

    await Booking.updateOne(
      { _id: payment.bookingId, paymentStatus: { $ne: 'paid' } },
      { $set: { paymentStatus: 'failed' } }
    );

    throw new AppError('Payment signature verification failed.', 400, 'INVALID_PAYMENT_SIGNATURE');
  }

  const { booking, invoice } = await finalizeCapturedPayment(
    payment,
    paymentId,
    signature,
    req.user ? { id: req.user.id, name: req.user.name, role: req.user.role } : undefined,
    req.ip
  );

  res.json({
    success: true,
    message: 'Payment verified successfully.',
    data: { alreadyProcessed: false, payment, booking, invoice },
  });
}

export async function handlePaymentWebhook(req: AuthRequest, res: Response): Promise<void> {
  const signature = String(req.headers['x-razorpay-signature'] || '');
  const rawBody = (req as AuthRequest & { rawBody?: Buffer }).rawBody || JSON.stringify(req.body);
  const gateway = getPaymentGateway();

  if (!gateway.verifyWebhookSignature(rawBody, signature)) {
    throw new AppError('Invalid webhook signature.', 400, 'INVALID_WEBHOOK_SIGNATURE');
  }

  const event = req.body?.event;
  const entity = req.body?.payload?.payment?.entity;

  if (event === 'payment.captured' && entity?.order_id && entity?.id) {
    const payment = await Payment.findOne({ orderId: entity.order_id });
    if (payment && payment.status !== 'captured') {
      await finalizeCapturedPayment(payment, entity.id, signature);
    }
  } else if (event === 'payment.failed' && entity?.order_id) {
    const payment = await Payment.findOne({ orderId: entity.order_id });
    if (payment && payment.status !== 'captured') {
      payment.status = 'failed';
      payment.failureReason = entity.error_description || 'Payment failed at gateway';
      await payment.save();
    }
  }

  res.json({ success: true, received: true });
}

export async function listPayments(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (req.user?.role === 'customer') {
    filter.customerId = req.user._id;
  } else if (req.companyId) {
    filter.companyId = req.companyId;
  } else {
    throw new AppError('Forbidden.', 403, 'FORBIDDEN');
  }

  const payments = await Payment.find(filter)
    .populate('bookingId', 'bookingReference startDate endDate status')
    .populate('customerId', 'name email')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ success: true, data: payments });
}

export async function listInvoices(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (req.user?.role === 'customer') {
    filter.customerId = req.user._id;
  } else if (req.companyId) {
    filter.companyId = req.companyId;
  } else {
    throw new AppError('Forbidden.', 403, 'FORBIDDEN');
  }

  const invoices = await Invoice.find(filter)
    .populate('bookingId', 'bookingReference startDate endDate status')
    .populate('companyId', 'name companyCode')
    .populate('customerId', 'name email')
    .sort({ issuedAt: -1 })
    .limit(100);

  res.json({ success: true, data: invoices });
}

export async function downloadInvoicePdf(req: AuthRequest, res: Response): Promise<void> {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) {
    throw new AppError('Invoice not found.', 404, 'INVOICE_NOT_FOUND');
  }

  if (
    req.user?.role === 'customer' &&
    invoice.customerId.toString() !== req.user._id.toString()
  ) {
    throw new AppError('Forbidden.', 403, 'FORBIDDEN');
  }
  if (req.companyId && invoice.companyId.toString() !== req.companyId.toString()) {
    throw new AppError('Invoice not found in your company workspace.', 404, 'INVOICE_NOT_FOUND');
  }

  const { buffer, filename } = await generateInvoicePdfBuffer(invoice._id.toString());

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

// Helper export for booking items summary if needed
export { BookingItem };
