import { Response } from 'express';
import { Booking } from '../models/Booking.js';
import { Delivery } from '../models/Delivery.js';
import { notifyUser } from '../services/notification.service.js';
import { AuthRequest } from '../types/index.js';
import { AppError } from '../utils/errors.js';

export async function listDeliveries(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (req.user?.role === 'customer') {
    filter.customerId = req.user._id;
  } else if (req.companyId) {
    filter.companyId = req.companyId;
  } else {
    throw new AppError('Forbidden.', 403, 'FORBIDDEN');
  }

  const deliveries = await Delivery.find(filter)
    .populate('bookingId', 'bookingReference startDate endDate status')
    .populate('customerId', 'name email phone')
    .populate('assignedStaffId', 'name email phone')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: deliveries });
}

export async function updateDelivery(req: AuthRequest, res: Response): Promise<void> {
  const delivery = await Delivery.findOne({
    _id: req.params.id,
    companyId: req.companyId,
  });
  if (!delivery) {
    throw new AppError('Delivery record not found.', 404, 'NOT_FOUND');
  }

  const { status, assignedStaffId, dispatchDate, expectedDeliveryDate, confirmationNote } = req.body;
  if (status) delivery.status = status;
  if (assignedStaffId !== undefined) delivery.assignedStaffId = assignedStaffId || undefined;
  if (dispatchDate) delivery.dispatchDate = new Date(dispatchDate);
  if (expectedDeliveryDate) delivery.expectedDeliveryDate = new Date(expectedDeliveryDate);
  if (confirmationNote !== undefined) delivery.confirmationNote = confirmationNote;
  if (status === 'delivered' || status === 'collected') {
    delivery.deliveredAt = new Date();
  }

  await delivery.save();

  // Sync booking status when delivery moves to dispatched/delivered/collected
  const booking = await Booking.findById(delivery.bookingId);
  if (booking && status) {
    if (status === 'dispatched' && booking.status !== 'out_for_delivery') {
      booking.status = 'out_for_delivery';
      booking.statusHistory.push({
        status: 'out_for_delivery',
        note: 'Dispatched for delivery',
        changedBy: req.user!._id,
        changedByName: req.user!.name,
        changedAt: new Date(),
      });
      await booking.save();
    } else if ((status === 'delivered' || status === 'collected') && booking.status !== 'active_rental') {
      booking.status = 'active_rental';
      booking.statusHistory.push({
        status: 'active_rental',
        note: `Fulfillment completed (${status})`,
        changedBy: req.user!._id,
        changedByName: req.user!.name,
        changedAt: new Date(),
      });
      await booking.save();
    }
  }

  await notifyUser({
    userId: delivery.customerId,
    companyId: delivery.companyId,
    type: 'DELIVERY_UPDATED',
    title: `Fulfillment Update — ${booking?.bookingReference || ''}`,
    message: `Your order fulfillment status is now "${delivery.status.replace(/_/g, ' ')}".`,
    link: `/customer/bookings/${delivery.bookingId}`,
  });

  const populated = await delivery.populate([
    { path: 'bookingId', select: 'bookingReference startDate endDate status' },
    { path: 'customerId', select: 'name email phone' },
    { path: 'assignedStaffId', select: 'name email phone' },
  ]);

  res.json({ success: true, message: 'Delivery updated.', data: populated });
}
