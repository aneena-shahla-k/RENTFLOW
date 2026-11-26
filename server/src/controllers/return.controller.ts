import { Response } from 'express';
import { Booking } from '../models/Booking.js';
import { BookingItem } from '../models/BookingItem.js';
import { Company } from '../models/Company.js';
import { Invoice } from '../models/Invoice.js';
import { MaintenancePeriod } from '../models/MaintenancePeriod.js';
import { Product } from '../models/Product.js';
import { RentalReturn } from '../models/RentalReturn.js';
import { logActivity } from '../services/activity.service.js';
import { notifyUser } from '../services/notification.service.js';
import { AuthRequest } from '../types/index.js';
import { AppError } from '../utils/errors.js';
import { calculatePercentage } from '../utils/money.js';

const MS_PER_DAY = 86_400_000;

export async function processReturn(req: AuthRequest, res: Response): Promise<void> {
  const {
    bookingId,
    actualReturnDate,
    returnCondition,
    damageReport,
    missingAccessories,
    damageFeeAmount = 0,
    additionalCharges = 0,
    lateFeeAmountOverride,
    putProductsInMaintenance = false,
    notes,
  } = req.body;

  const booking = await Booking.findOne({
    _id: bookingId,
    companyId: req.companyId,
  });

  if (!booking) {
    throw new AppError('Booking not found in your workspace.', 404, 'BOOKING_NOT_FOUND');
  }

  const existing = await RentalReturn.findOne({ bookingId: booking._id });
  if (existing) {
    throw new AppError('Return has already been processed for this booking.', 409, 'RETURN_EXISTS');
  }

  const company = await Company.findById(req.companyId);
  const items = await BookingItem.find({ bookingId: booking._id });

  const actualDate = actualReturnDate ? new Date(actualReturnDate) : new Date();
  const expectedDate = new Date(booking.endDate);

  // Calculate calendar late days
  const expectedDayMs = Date.UTC(
    expectedDate.getUTCFullYear(),
    expectedDate.getUTCMonth(),
    expectedDate.getUTCDate()
  );
  const actualDayMs = Date.UTC(
    actualDate.getUTCFullYear(),
    actualDate.getUTCMonth(),
    actualDate.getUTCDate()
  );
  const lateDays = Math.max(0, Math.floor((actualDayMs - expectedDayMs) / MS_PER_DAY));

  const dailyRateTotal = items.reduce((sum, i) => sum + i.unitDailyPrice * i.quantity, 0);
  const latePercent = company?.settings?.lateFeePerDayPercent ?? 25;
  const computedLateFee =
    lateDays > 0 ? lateDays * (dailyRateTotal + calculatePercentage(dailyRateTotal, latePercent)) : 0;

  const lateFeeAmount =
    lateFeeAmountOverride !== undefined ? Number(lateFeeAmountOverride) : computedLateFee;

  const depositHeld = booking.pricing.securityDeposit || 0;
  const totalDeductions =
    lateFeeAmount + Number(damageFeeAmount || 0) + Number(additionalCharges || 0);
  const depositRefundAmount = Math.max(0, depositHeld - totalDeductions);

  let depositRefundStatus: 'pending' | 'partial_refund' | 'refunded' | 'forfeited' = 'refunded';
  if (depositHeld === 0) {
    depositRefundStatus = 'refunded';
  } else if (depositRefundAmount === 0) {
    depositRefundStatus = 'forfeited';
  } else if (depositRefundAmount < depositHeld) {
    depositRefundStatus = 'partial_refund';
  }

  const shouldHoldInMaintenance =
    Boolean(putProductsInMaintenance) ||
    returnCondition === 'damaged' ||
    returnCondition === 'missing_items';

  const rentalReturn = await RentalReturn.create({
    companyId: req.companyId,
    bookingId: booking._id,
    customerId: booking.customerId,
    processedBy: req.user!._id,
    expectedReturnDate: expectedDate,
    actualReturnDate: actualDate,
    returnCondition,
    damageReport,
    missingAccessories,
    lateDays,
    lateFeeAmount,
    damageFeeAmount: Number(damageFeeAmount || 0),
    additionalCharges: Number(additionalCharges || 0),
    depositHeld,
    depositRefundAmount,
    depositRefundStatus,
    putProductsInMaintenance: shouldHoldInMaintenance,
    status: 'completed',
    notes,
  });

  // Update booking status and charges
  const previousStatus = booking.status;
  booking.status = shouldHoldInMaintenance ? 'returned' : 'completed';
  booking.pricing.lateFeeAmount = lateFeeAmount;
  booking.pricing.damageFeeAmount = Number(damageFeeAmount || 0);
  booking.pricing.totalAmount +=
    lateFeeAmount + Number(damageFeeAmount || 0) + Number(additionalCharges || 0);
  booking.statusHistory.push({
    status: booking.status,
    note: `Return processed (${returnCondition}). Late days: ${lateDays}`,
    changedBy: req.user!._id,
    changedByName: req.user!.name,
    changedAt: new Date(),
  });
  await booking.save();

  await Invoice.updateOne(
    { bookingId: booking._id },
    {
      $set: {
        lateFeeAmount,
        damageFeeAmount: Number(damageFeeAmount || 0),
        totalAmount: booking.pricing.totalAmount,
      },
    }
  );

  // Inventory restoration vs. maintenance protection
  const wasCheckedOut = ['active_rental', 'out_for_delivery', 'overdue', 'return_requested'].includes(
    previousStatus
  );

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    if (shouldHoldInMaintenance) {
      // Do NOT automatically make damaged/maintenance products available for new bookings
      await MaintenancePeriod.create({
        companyId: req.companyId,
        productId: product._id,
        startDate: actualDate,
        endDate: new Date(actualDate.getTime() + 7 * MS_PER_DAY),
        quantityBlocked: Math.min(item.quantity, product.totalStock),
        reason: damageReport || missingAccessories || 'Post-return inspection / maintenance',
        status: 'in_progress',
        createdBy: req.user!._id,
      });

      if (item.quantity >= product.totalStock) {
        product.status = 'maintenance';
        product.availableStock = 0;
      } else {
        product.availableStock = Math.max(0, product.availableStock - item.quantity);
      }
      await product.save();
    } else if (wasCheckedOut && product.status === 'active') {
      product.availableStock = Math.min(product.totalStock, product.availableStock + item.quantity);
      await product.save();
    }
  }

  await logActivity({
    companyId: req.companyId,
    actorId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'RETURN_PROCESSED',
    resourceType: 'RentalReturn',
    resourceId: rentalReturn._id.toString(),
    description: `Processed return for ${booking.bookingReference} (${returnCondition})`,
    ipAddress: req.ip,
  });

  await notifyUser({
    userId: booking.customerId,
    companyId: booking.companyId,
    type: 'RETURN_PROCESSED',
    title: `Return Completed — ${booking.bookingReference}`,
    message: `Your equipment return was recorded (${returnCondition.replace(/_/g, ' ')}). Refundable deposit: ${(depositRefundAmount / 100).toFixed(2)}.`,
    link: `/customer/bookings/${booking._id}`,
    sendEmailNotification: true,
  });

  res.status(201).json({
    success: true,
    message: 'Return processed successfully.',
    data: rentalReturn,
  });
}

export async function listReturns(req: AuthRequest, res: Response): Promise<void> {
  const returns = await RentalReturn.find({ companyId: req.companyId })
    .populate('bookingId', 'bookingReference startDate endDate status')
    .populate('customerId', 'name email phone')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: returns });
}

export async function updateReturn(req: AuthRequest, res: Response): Promise<void> {
  const ret = await RentalReturn.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { $set: req.body },
    { new: true }
  );
  if (!ret) throw new AppError('Return record not found.', 404, 'NOT_FOUND');
  res.json({ success: true, message: 'Return updated.', data: ret });
}
