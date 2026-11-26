import crypto from 'crypto';
import { Response } from 'express';
import { ActivityLog } from '../models/ActivityLog.js';
import { Booking } from '../models/Booking.js';
import { BookingItem } from '../models/BookingItem.js';
import { CustomerAddress } from '../models/CustomerAddress.js';
import { Notification } from '../models/Notification.js';
import { Product } from '../models/Product.js';
import { Review } from '../models/Review.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { uploadImageBuffer } from '../services/storage.service.js';
import { AuthRequest } from '../types/index.js';
import { AppError } from '../utils/errors.js';

// === NOTIFICATIONS ===
export async function listNotifications(req: AuthRequest, res: Response): Promise<void> {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ userId: req.user!._id }).sort({ createdAt: -1 }).limit(40),
    Notification.countDocuments({ userId: req.user!._id, isRead: false }),
  ]);
  res.json({ success: true, data: { items, unreadCount } });
}

export async function markNotificationRead(req: AuthRequest, res: Response): Promise<void> {
  await Notification.updateOne(
    { _id: req.params.id, userId: req.user!._id },
    { $set: { isRead: true } }
  );
  res.json({ success: true, message: 'Notification marked as read.' });
}

export async function markAllNotificationsRead(req: AuthRequest, res: Response): Promise<void> {
  await Notification.updateMany({ userId: req.user!._id, isRead: false }, { $set: { isRead: true } });
  res.json({ success: true, message: 'All notifications marked as read.' });
}

// === REVIEWS ===
export async function listProductReviews(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (req.params.productId) {
    filter.productId = req.params.productId;
    filter.moderationStatus = 'approved';
  } else if (req.companyId) {
    filter.companyId = req.companyId;
  }

  const reviews = await Review.find(filter)
    .populate('customerId', 'name')
    .populate('productId', 'name sku')
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ success: true, data: reviews });
}

async function recalculateProductRating(productId: string) {
  const stats = await Review.aggregate([
    { $match: { productId: (await Product.findById(productId))?._id, moderationStatus: 'approved' } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (stats[0]) {
    await Product.updateOne(
      { _id: productId },
      { $set: { averageRating: Math.round(stats[0].avg * 10) / 10, reviewCount: stats[0].count } }
    );
  } else {
    await Product.updateOne({ _id: productId }, { $set: { averageRating: 0, reviewCount: 0 } });
  }
}

export async function createReview(req: AuthRequest, res: Response): Promise<void> {
  const { bookingId, productId, rating, comment } = req.body;

  // Verify customer completed this booking and it includes this product
  const booking = await Booking.findOne({
    _id: bookingId,
    customerId: req.user!._id,
    status: { $in: ['returned', 'completed'] },
  });

  if (!booking) {
    throw new AppError(
      'You can only submit verified reviews after completing a rental booking.',
      403,
      'INELIGIBLE_FOR_REVIEW'
    );
  }

  const bookingItem = await BookingItem.findOne({ bookingId: booking._id, productId });
  if (!bookingItem) {
    throw new AppError('This product was not part of the specified booking.', 400, 'INVALID_PRODUCT');
  }

  const review = await Review.create({
    companyId: booking.companyId,
    productId,
    bookingId: booking._id,
    customerId: req.user!._id,
    rating: Number(rating),
    comment,
    verifiedRental: true,
    moderationStatus: 'approved',
  });

  await recalculateProductRating(productId);

  res.status(201).json({ success: true, message: 'Verified review submitted!', data: review });
}

export async function moderateReview(req: AuthRequest, res: Response): Promise<void> {
  const review = await Review.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { $set: { moderationStatus: req.body.moderationStatus } },
    { new: true }
  );
  if (!review) throw new AppError('Review not found.', 404, 'NOT_FOUND');
  await recalculateProductRating(review.productId.toString());
  res.json({ success: true, message: 'Review moderation updated.', data: review });
}

// === SUPPORT TICKETS ===
export async function listSupportTickets(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (req.user?.role === 'customer') {
    filter.customerId = req.user._id;
  } else if (req.companyId) {
    filter.companyId = req.companyId;
  } else if (req.user?.role !== 'super_admin') {
    throw new AppError('Forbidden.', 403, 'FORBIDDEN');
  }

  const tickets = await SupportTicket.find(filter)
    .populate('customerId', 'name email')
    .populate('companyId', 'name')
    .populate('assignedTo', 'name email')
    .sort({ updatedAt: -1 });

  res.json({ success: true, data: tickets });
}

export async function createSupportTicket(req: AuthRequest, res: Response): Promise<void> {
  let attachmentUrl = req.body.attachmentUrl;
  if (req.file) {
    const uploaded = await uploadImageBuffer(
      req.file.buffer,
      req.file.mimetype,
      'rentflow/support'
    );
    attachmentUrl = uploaded.url;
  }

  const ticketNumber = `TKT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const ticket = await SupportTicket.create({
    ticketNumber,
    companyId: req.body.companyId || req.companyId || undefined,
    customerId: req.user!._id,
    category: req.body.category || 'other',
    subject: req.body.subject,
    description: req.body.description,
    attachmentUrl,
    priority: req.body.priority || 'medium',
    messages: [
      {
        senderId: req.user!._id,
        senderName: req.user!.name,
        senderRole: req.user!.role,
        message: req.body.description,
        attachmentUrl,
        createdAt: new Date(),
      },
    ],
  });

  res.status(201).json({ success: true, message: 'Support ticket opened.', data: ticket });
}

export async function replySupportTicket(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = { _id: req.params.id };
  if (req.user?.role === 'customer') filter.customerId = req.user._id;
  else if (req.companyId) filter.companyId = req.companyId;

  const ticket = await SupportTicket.findOne(filter);
  if (!ticket) throw new AppError('Ticket not found.', 404, 'NOT_FOUND');

  ticket.messages.push({
    senderId: req.user!._id,
    senderName: req.user!.name,
    senderRole: req.user!.role,
    message: req.body.message,
    createdAt: new Date(),
  });

  if (req.user?.role !== 'customer' && ticket.status === 'open') {
    ticket.status = 'in_progress';
  }
  await ticket.save();

  res.json({ success: true, message: 'Reply posted.', data: ticket });
}

export async function updateSupportTicket(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = { _id: req.params.id };
  if (req.companyId) filter.companyId = req.companyId;

  const ticket = await SupportTicket.findOneAndUpdate(filter, { $set: req.body }, { new: true });
  if (!ticket) throw new AppError('Ticket not found.', 404, 'NOT_FOUND');
  res.json({ success: true, message: 'Ticket updated.', data: ticket });
}

// === CUSTOMERS DIRECTORY & SAVED ADDRESSES ===
export async function listCompanyCustomers(req: AuthRequest, res: Response): Promise<void> {
  const customers = await Booking.aggregate([
    { $match: { companyId: req.companyId } },
    {
      $group: {
        _id: '$customerId',
        bookingCount: { $sum: 1 },
        totalSpent: { $sum: '$pricing.totalAmount' },
        lastBookingAt: { $max: '$createdAt' },
      },
    },
    { $sort: { lastBookingAt: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: '$user._id',
        name: '$user.name',
        email: '$user.email',
        phone: '$user.phone',
        bookingCount: 1,
        totalSpent: 1,
        lastBookingAt: 1,
      },
    },
  ]);

  res.json({ success: true, data: customers });
}

export async function listCustomerAddresses(req: AuthRequest, res: Response): Promise<void> {
  const addresses = await CustomerAddress.find({ customerId: req.user!._id }).sort({
    isDefault: -1,
    createdAt: -1,
  });
  res.json({ success: true, data: addresses });
}

export async function createCustomerAddress(req: AuthRequest, res: Response): Promise<void> {
  if (req.body.isDefault) {
    await CustomerAddress.updateMany({ customerId: req.user!._id }, { $set: { isDefault: false } });
  }
  const address = await CustomerAddress.create({ ...req.body, customerId: req.user!._id });
  res.status(201).json({ success: true, data: address });
}

export async function deleteCustomerAddress(req: AuthRequest, res: Response): Promise<void> {
  await CustomerAddress.deleteOne({ _id: req.params.id, customerId: req.user!._id });
  res.json({ success: true, message: 'Address removed.' });
}

// === ACTIVITY LOGS ===
export async function listActivityLogs(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (req.companyId) {
    filter.companyId = req.companyId;
  } else if (req.user?.role !== 'super_admin') {
    throw new AppError('Forbidden.', 403, 'FORBIDDEN');
  }

  const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, data: logs });
}
