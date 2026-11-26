import crypto from 'crypto';
import { Response } from 'express';
import { Booking } from '../models/Booking.js';
import { BookingItem } from '../models/BookingItem.js';
import { Company } from '../models/Company.js';
import { Delivery } from '../models/Delivery.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { Product } from '../models/Product.js';
import { RentalReturn } from '../models/RentalReturn.js';
import { Subscription } from '../models/Subscription.js';
import { logActivity } from '../services/activity.service.js';
import {
  checkProductAvailabilityForRange,
  releaseExpiredHolds,
  withProductLocks,
} from '../services/availability.service.js';
import { notifyCompanyAdmins, notifyUser } from '../services/notification.service.js';
import { calculateBookingPricing } from '../services/pricing.service.js';
import { AuthRequest, BookingStatus, SUBSCRIPTION_PLANS } from '../types/index.js';
import { normalizeRentalRange } from '../utils/dateRange.js';
import { AppError } from '../utils/errors.js';
import { escapeRegex } from '../utils/sanitize.js';

export async function checkAvailability(req: AuthRequest, res: Response): Promise<void> {
  const { startDate, endDate, items, fulfillmentType, discountAmount } = req.body;
  const range = normalizeRentalRange(startDate, endDate);

  const productIds = items.map((i: { productId: string }) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  if (products.length !== productIds.length) {
    throw new AppError('One or more products could not be found.', 404, 'PRODUCT_NOT_FOUND');
  }

  const companyIds = new Set(products.map((p) => p.companyId.toString()));
  if (companyIds.size !== 1) {
    throw new AppError(
      'All items in a booking must belong to the same rental company.',
      400,
      'MIXED_COMPANIES'
    );
  }

  const company = await Company.findById(Array.from(companyIds)[0]);
  if (!company || company.status !== 'approved') {
    throw new AppError('Rental company is not active.', 400, 'COMPANY_UNAVAILABLE');
  }

  const results = await Promise.all(
    items.map((line: { productId: string; quantity: number }) =>
      checkProductAvailabilityForRange({
        productId: line.productId,
        startDate: range.startDate,
        endDate: range.endDate,
        requestedQuantity: line.quantity,
      })
    )
  );

  const allAvailable = results.every((r) => r.isAvailable);

  const pricing = calculateBookingPricing({
    items: items.map((line: { productId: string; quantity: number }) => {
      const product = products.find((p) => p._id.toString() === line.productId)!;
      return {
        product,
        quantity: line.quantity,
        rentalDays: range.rentalDays,
      };
    }),
    settings: company.settings,
    fulfillmentType: fulfillmentType || 'pickup',
    discountAmount: discountAmount || 0,
  });

  res.json({
    success: true,
    data: {
      available: allAvailable,
      startDate: range.startDate,
      endDate: range.endDate,
      rentalDays: range.rentalDays,
      items: results,
      pricing,
      currency: company.settings.currency,
      currencySymbol: company.settings.currencySymbol,
    },
  });
}

export async function createBooking(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { startDate, endDate, items, fulfillmentType, deliveryAddress, notes, asHold } = req.body;
  const range = normalizeRentalRange(startDate, endDate);

  const productIds = items.map((i: { productId: string }) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  if (products.length !== productIds.length) {
    throw new AppError('One or more selected products were not found.', 404, 'PRODUCT_NOT_FOUND');
  }

  const companyIds = new Set(products.map((p) => p.companyId.toString()));
  if (companyIds.size !== 1) {
    throw new AppError(
      'All items in a booking must belong to the same rental company.',
      400,
      'MIXED_COMPANIES'
    );
  }

  const companyId = Array.from(companyIds)[0];
  const company = await Company.findById(companyId);
  if (!company || company.status !== 'approved') {
    throw new AppError('This rental company is currently unavailable.', 400, 'COMPANY_UNAVAILABLE');
  }

  if (range.rentalDays < company.settings.minRentalDays) {
    throw new AppError(
      `Minimum rental duration for ${company.name} is ${company.settings.minRentalDays} day(s).`,
      400,
      'MIN_RENTAL_DAYS'
    );
  }
  if (range.rentalDays > company.settings.maxRentalDays) {
    throw new AppError(
      `Maximum rental duration for ${company.name} is ${company.settings.maxRentalDays} day(s).`,
      400,
      'MAX_RENTAL_DAYS'
    );
  }
  if (fulfillmentType === 'delivery' && !company.settings.deliveryEnabled) {
    throw new AppError(
      `${company.name} only supports customer pickup.`,
      400,
      'DELIVERY_DISABLED'
    );
  }
  if (fulfillmentType === 'delivery' && !deliveryAddress) {
    throw new AppError('Delivery address is required for delivery fulfillment.', 400, 'ADDRESS_REQUIRED');
  }

  // Enforce monthly booking subscription quota
  const subscription = await Subscription.findOne({ companyId: company._id });
  const planId = subscription?.plan || 'starter';
  const maxMonthlyBookings = SUBSCRIPTION_PLANS[planId].limits.maxBookingsPerMonth;
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthlyCount = await Booking.countDocuments({
    companyId: company._id,
    createdAt: { $gte: monthStart },
    status: { $ne: 'cancelled' },
  });
  if (monthlyCount >= maxMonthlyBookings) {
    throw new AppError(
      'This rental provider has reached their monthly booking capacity.',
      403,
      'PLAN_LIMIT_REACHED'
    );
  }

  const booking = await withProductLocks(productIds, async (session) => {
    // Re-validate availability inside atomic lock / transaction
    for (const line of items) {
      const check = await checkProductAvailabilityForRange({
        productId: line.productId,
        startDate: range.startDate,
        endDate: range.endDate,
        requestedQuantity: line.quantity,
        session,
      });
      if (!check.isAvailable) {
        throw new AppError(
          check.reason || 'These dates are unavailable. Please choose another rental period.',
          409,
          'INSUFFICIENT_STOCK',
          check
        );
      }
    }

    const pricing = calculateBookingPricing({
      items: items.map((line: { productId: string; quantity: number }) => {
        const product = products.find((p) => p._id.toString() === line.productId)!;
        return { product, quantity: line.quantity, rentalDays: range.rentalDays };
      }),
      settings: company.settings,
      fulfillmentType,
    });

    const bookingReference = `RF-${new Date().getUTCFullYear()}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    const initialStatus: BookingStatus = asHold ? 'hold' : 'pending';
    const holdMinutes = company.settings.bookingHoldMinutes || 15;
    const holdExpiresAt = asHold ? new Date(Date.now() + holdMinutes * 60 * 1000) : undefined;

    const createdArr = await Booking.create(
      [
        {
          bookingReference,
          companyId: company._id,
          customerId: req.user!._id,
          startDate: range.startDate,
          endDate: range.endDate,
          rentalDays: range.rentalDays,
          status: initialStatus,
          paymentStatus: 'unpaid',
          fulfillmentType,
          deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress : undefined,
          pricing: {
            rentalDays: pricing.rentalDays,
            rentalSubtotal: pricing.rentalSubtotal,
            discountAmount: pricing.discountAmount,
            taxableAmount: pricing.taxableAmount,
            taxRate: pricing.taxRate,
            taxInclusive: pricing.taxInclusive,
            taxAmount: pricing.taxAmount,
            deliveryFee: pricing.deliveryFee,
            securityDeposit: pricing.securityDeposit,
            lateFeeAmount: 0,
            damageFeeAmount: 0,
            totalAmount: pricing.totalAmount,
          },
          notes,
          holdExpiresAt,
          statusHistory: [
            {
              status: initialStatus,
              note: asHold ? 'Temporary hold created for checkout' : 'Booking submitted by customer',
              changedBy: req.user!._id,
              changedByName: req.user!.name,
              changedAt: new Date(),
            },
          ],
        },
      ],
      session ? { session } : undefined
    );

    const createdBooking = createdArr[0];

    const bookingItemDocs = items.map(
      (line: { productId: string; quantity: number }, index: number) => {
        const product = products.find((p) => p._id.toString() === line.productId)!;
        return {
          bookingId: createdBooking._id,
          companyId: company._id,
          productId: product._id,
          productName: product.name,
          productSku: product.sku,
          quantity: line.quantity,
          unitDailyPrice: product.pricePerDay,
          unitWeeklyPrice: product.pricePerWeek,
          unitMonthlyPrice: product.pricePerMonth,
          lineSubtotal: pricing.itemSubtotals[index],
          depositPerUnit: company.settings.securityDepositRequired ? product.securityDeposit : 0,
          startDate: range.startDate,
          endDate: range.endDate,
        };
      }
    );

    await BookingItem.insertMany(bookingItemDocs, session ? { session } : {});

    if (fulfillmentType === 'delivery' || company.settings.deliveryEnabled) {
      await Delivery.create(
        [
          {
            companyId: company._id,
            bookingId: createdBooking._id,
            customerId: req.user!._id,
            fulfillmentType,
            status: fulfillmentType === 'delivery' ? 'pending' : 'pickup_scheduled',
            deliveryCharge: pricing.deliveryFee,
            address: deliveryAddress,
          },
        ],
        session ? { session } : undefined
      );
    }

    return createdBooking;
  });

  if (!asHold) {
    await Promise.all([
      notifyUser({
        userId: req.user._id,
        companyId: company._id,
        type: 'BOOKING_SUBMITTED',
        title: `Booking ${booking.bookingReference} Submitted`,
        message: `Your rental booking for ${range.rentalDays} day(s) with ${company.name} has been submitted.`,
        link: `/customer/bookings/${booking._id}`,
        sendEmailNotification: true,
      }),
      notifyCompanyAdmins({
        companyId: company._id,
        type: 'NEW_BOOKING',
        title: `New Booking ${booking.bookingReference}`,
        message: `${req.user.name} submitted a booking for ${range.rentalDays} day(s).`,
        link: `/admin/bookings/${booking._id}`,
        sendEmailNotification: SUBSCRIPTION_PLANS[planId].limits.emailNotificationsEnabled,
      }),
    ]);
  }

  const bookingItems = await BookingItem.find({ bookingId: booking._id });

  res.status(201).json({
    success: true,
    message: asHold ? 'Temporary hold reserved.' : 'Booking submitted successfully.',
    data: {
      booking,
      items: bookingItems,
    },
  });
}

export async function listBookings(req: AuthRequest, res: Response): Promise<void> {
  await releaseExpiredHolds();

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
  const status = String(req.query.status || '').trim();
  const search = String(req.query.search || '').trim();

  const filter: Record<string, unknown> = {};

  if (req.user?.role === 'customer') {
    filter.customerId = req.user._id;
  } else if (req.companyId) {
    filter.companyId = req.companyId;
  } else {
    throw new AppError('Unauthorized booking query.', 403, 'FORBIDDEN');
  }

  if (status) {
    filter.status = status;
  }
  if (search) {
    filter.bookingReference = new RegExp(escapeRegex(search), 'i');
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('customerId', 'name email phone')
      .populate('companyId', 'name companyCode logoUrl settings.currency settings.currencySymbol')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  const bookingIds = bookings.map((b) => b._id);
  const allItems = await BookingItem.find({ bookingId: { $in: bookingIds } });

  const enriched = bookings.map((b) => ({
    ...b.toObject(),
    items: allItems.filter((item) => item.bookingId.toString() === b._id.toString()),
  }));

  res.json({
    success: true,
    data: {
      items: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  });
}

export async function getBookingById(req: AuthRequest, res: Response): Promise<void> {
  await releaseExpiredHolds();

  const booking = await Booking.findById(req.params.id)
    .populate('customerId', 'name email phone')
    .populate('companyId', 'name companyCode email phone logoUrl address settings');

  if (!booking) {
    throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
  }

  // Strict authorization: customer only owns theirs; company roles only own their company's
  if (req.user?.role === 'customer') {
    if (booking.customerId._id.toString() !== req.user._id.toString()) {
      throw new AppError('You do not have permission to view this booking.', 403, 'FORBIDDEN');
    }
  } else if (req.companyId) {
    if (booking.companyId._id.toString() !== req.companyId.toString()) {
      throw new AppError('Booking not found in your company workspace.', 404, 'BOOKING_NOT_FOUND');
    }
  } else if (req.user?.role !== 'super_admin') {
    throw new AppError('Forbidden.', 403, 'FORBIDDEN');
  }

  const [items, payment, invoice, rentalReturn, delivery] = await Promise.all([
    BookingItem.find({ bookingId: booking._id }).populate('productId', 'name images sku'),
    Payment.findOne({ bookingId: booking._id }).sort({ createdAt: -1 }),
    Invoice.findOne({ bookingId: booking._id }),
    RentalReturn.findOne({ bookingId: booking._id }),
    Delivery.findOne({ bookingId: booking._id }).populate('assignedStaffId', 'name email phone'),
  ]);

  res.json({
    success: true,
    data: {
      booking,
      items,
      payment,
      invoice,
      rentalReturn,
      delivery,
    },
  });
}

export async function updateBookingStatus(req: AuthRequest, res: Response): Promise<void> {
  const { status, note, startDate, endDate } = req.body;

  const booking = await Booking.findOne({
    _id: req.params.id,
    companyId: req.companyId,
  });

  if (!booking) {
    throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
  }

  // Optional date modification check
  if (startDate || endDate) {
    const nextRange = normalizeRentalRange(
      startDate || booking.startDate,
      endDate || booking.endDate
    );
    const items = await BookingItem.find({ bookingId: booking._id });
    for (const item of items) {
      const check = await checkProductAvailabilityForRange({
        productId: item.productId,
        startDate: nextRange.startDate,
        endDate: nextRange.endDate,
        requestedQuantity: item.quantity,
        excludeBookingId: booking._id,
      });
      if (!check.isAvailable) {
        throw new AppError(
          check.reason || 'Modified dates conflict with another booking.',
          409,
          'DATE_CONFLICT'
        );
      }
    }
    booking.startDate = nextRange.startDate;
    booking.endDate = nextRange.endDate;
    booking.rentalDays = nextRange.rentalDays;
    await BookingItem.updateMany(
      { bookingId: booking._id },
      { $set: { startDate: nextRange.startDate, endDate: nextRange.endDate } }
    );
  }

  const previousStatus = booking.status;
  booking.status = status;
  if (status === 'rejected' && note) booking.rejectionReason = note;
  if (status === 'cancelled' && note) booking.cancellationReason = note;
  booking.holdExpiresAt = undefined;

  booking.statusHistory.push({
    status,
    note: note || `Status changed from ${previousStatus} to ${status}`,
    changedBy: req.user!._id,
    changedByName: req.user!.name,
    changedAt: new Date(),
  });

  await booking.save();

  // Keep Product.availableStock synchronized when entering or leaving active rental
  const items = await BookingItem.find({ bookingId: booking._id });
  const enteredHandover =
    !['active_rental', 'out_for_delivery'].includes(previousStatus) &&
    ['active_rental', 'out_for_delivery'].includes(status);
  const exitedHandover =
    ['active_rental', 'out_for_delivery', 'overdue'].includes(previousStatus) &&
    ['returned', 'completed', 'cancelled'].includes(status);

  if (enteredHandover) {
    for (const item of items) {
      await Product.updateOne(
        { _id: item.productId, availableStock: { $gte: item.quantity } },
        { $inc: { availableStock: -item.quantity } }
      );
    }
  } else if (exitedHandover) {
    for (const item of items) {
      const prod = await Product.findById(item.productId);
      if (prod && prod.status === 'active') {
        prod.availableStock = Math.min(prod.totalStock, prod.availableStock + item.quantity);
        await prod.save();
      }
    }
  }

  await logActivity({
    companyId: req.companyId,
    actorId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: `BOOKING_${status.toUpperCase()}`,
    resourceType: 'Booking',
    resourceId: booking._id.toString(),
    description: `Updated booking ${booking.bookingReference} to ${status}`,
    ipAddress: req.ip,
  });

  await notifyUser({
    userId: booking.customerId,
    companyId: booking.companyId,
    type: `BOOKING_${status.toUpperCase()}`,
    title: `Booking ${booking.bookingReference} — ${status.replace(/_/g, ' ')}`,
    message: note || `Your booking status is now "${status.replace(/_/g, ' ')}".`,
    link: `/customer/bookings/${booking._id}`,
    sendEmailNotification: ['confirmed', 'rejected', 'cancelled', 'overdue'].includes(status),
  });

  res.json({
    success: true,
    message: `Booking status updated to ${status}.`,
    data: booking,
  });
}

export async function cancelBooking(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = { _id: req.params.id };
  if (req.user?.role === 'customer') {
    filter.customerId = req.user._id;
  } else if (req.companyId) {
    filter.companyId = req.companyId;
  }

  const booking = await Booking.findOne(filter);
  if (!booking) {
    throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
  }

  const cancellableStatuses: BookingStatus[] = ['hold', 'pending', 'confirmed', 'payment_pending', 'paid'];
  if (!cancellableStatuses.includes(booking.status)) {
    throw new AppError(
      `Booking cannot be cancelled once it is ${booking.status.replace(/_/g, ' ')}.`,
      400,
      'NOT_CANCELLABLE'
    );
  }

  booking.status = 'cancelled';
  booking.cancellationReason = req.body.reason || 'Cancelled by user';
  booking.statusHistory.push({
    status: 'cancelled',
    note: booking.cancellationReason,
    changedBy: req.user!._id,
    changedByName: req.user!.name,
    changedAt: new Date(),
  });
  await booking.save();

  await logActivity({
    companyId: booking.companyId,
    actorId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'BOOKING_CANCELLED',
    resourceType: 'Booking',
    resourceId: booking._id.toString(),
    description: `Cancelled booking ${booking.bookingReference}`,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'Booking cancelled successfully.',
    data: booking,
  });
}

export async function handleBookingExtension(req: AuthRequest, res: Response): Promise<void> {
  const { action, requestedEndDate, reason } = req.body;

  if (action === 'request') {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customerId: req.user!._id,
    });
    if (!booking) throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    if (!requestedEndDate) throw new AppError('Requested end date is required.', 400, 'DATE_REQUIRED');

    const { endDate } = normalizeRentalRange(booking.startDate, requestedEndDate);
    if (endDate <= booking.endDate) {
      throw new AppError('Extended end date must be after current end date.', 400, 'INVALID_EXTENSION');
    }

    booking.extensionRequested = {
      requestedEndDate: endDate,
      status: 'pending',
      reason,
      requestedAt: new Date(),
    };
    await booking.save();

    await notifyCompanyAdmins({
      companyId: booking.companyId,
      type: 'EXTENSION_REQUESTED',
      title: `Extension Requested: ${booking.bookingReference}`,
      message: `${req.user!.name} requested to extend return date to ${endDate.toISOString().slice(0, 10)}.`,
      link: `/admin/bookings/${booking._id}`,
    });

    res.json({ success: true, message: 'Extension request submitted.', data: booking });
    return;
  }

  // Admin approve / reject
  if (!req.companyId) throw new AppError('Company access required.', 403, 'FORBIDDEN');
  const booking = await Booking.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!booking || !booking.extensionRequested) {
    throw new AppError('No pending extension request found.', 404, 'NOT_FOUND');
  }

  if (action === 'approve') {
    const targetEnd = booking.extensionRequested.requestedEndDate;
    const items = await BookingItem.find({ bookingId: booking._id });

    for (const item of items) {
      const check = await checkProductAvailabilityForRange({
        productId: item.productId,
        startDate: booking.startDate,
        endDate: targetEnd,
        requestedQuantity: item.quantity,
        excludeBookingId: booking._id,
      });
      if (!check.isAvailable) {
        throw new AppError(
          check.reason || 'Extended dates are unavailable due to another reservation.',
          409,
          'EXTENSION_CONFLICT'
        );
      }
    }

    const range = normalizeRentalRange(booking.startDate, targetEnd);
    booking.endDate = range.endDate;
    booking.rentalDays = range.rentalDays;
    booking.extensionRequested.status = 'approved';
    booking.statusHistory.push({
      status: booking.status,
      note: `Extension approved until ${range.endDate.toISOString().slice(0, 10)}`,
      changedBy: req.user!._id,
      changedByName: req.user!.name,
      changedAt: new Date(),
    });
    await booking.save();
    await BookingItem.updateMany({ bookingId: booking._id }, { $set: { endDate: range.endDate } });
  } else {
    booking.extensionRequested.status = 'rejected';
    await booking.save();
  }

  await notifyUser({
    userId: booking.customerId,
    companyId: booking.companyId,
    type: 'EXTENSION_STATUS',
    title: `Extension ${action === 'approve' ? 'Approved' : 'Rejected'}`,
    message: `Your extension request for ${booking.bookingReference} was ${action === 'approve' ? 'approved' : 'rejected'}.`,
    link: `/customer/bookings/${booking._id}`,
    sendEmailNotification: true,
  });

  res.json({
    success: true,
    message: `Extension ${action === 'approve' ? 'approved' : 'rejected'}.`,
    data: booking,
  });
}
