import { Response } from 'express';
import { ActivityLog } from '../models/ActivityLog.js';
import { Booking } from '../models/Booking.js';
import { BookingItem } from '../models/BookingItem.js';
import { Product } from '../models/Product.js';
import { AuthRequest } from '../types/index.js';

function resolveDateFilter(range: string, startStr?: string, endStr?: string): { start: Date; end: Date } {
  const now = new Date();
  const end = endStr ? new Date(endStr) : new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  let start = new Date(now);
  switch (range) {
    case 'today':
      start.setUTCHours(0, 0, 0, 0);
      break;
    case '7d':
      start.setUTCDate(start.getUTCDate() - 6);
      start.setUTCHours(0, 0, 0, 0);
      break;
    case 'this_month':
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      break;
    case 'custom':
      if (startStr) {
        start = new Date(startStr);
        start.setUTCHours(0, 0, 0, 0);
      } else {
        start.setUTCDate(start.getUTCDate() - 29);
        start.setUTCHours(0, 0, 0, 0);
      }
      break;
    case '30d':
    default:
      start.setUTCDate(start.getUTCDate() - 29);
      start.setUTCHours(0, 0, 0, 0);
      break;
  }

  return { start, end };
}

export async function getAdminDashboard(req: AuthRequest, res: Response): Promise<void> {
  const companyId = req.companyId!;
  const range = String(req.query.range || '30d');
  const { start, end } = resolveDateFilter(
    range,
    req.query.startDate ? String(req.query.startDate) : undefined,
    req.query.endDate ? String(req.query.endDate) : undefined
  );

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

  const [
    totalProducts,
    availableProducts,
    rentedItemsAgg,
    activeBookings,
    pendingBookings,
    overdueReturns,
    totalRevenueAgg,
    monthlyRevenueAgg,
    monthlyRevenueSeries,
    bookingTrendSeries,
    categoryDist,
    mostRentedProducts,
    bookingStatusDist,
    recentBookings,
    upcomingReturns,
    lowStockProducts,
    recentActivities,
  ] = await Promise.all([
    Product.countDocuments({ companyId, status: { $ne: 'archived' } }),
    Product.countDocuments({ companyId, status: 'active', availableStock: { $gt: 0 } }),
    Booking.aggregate([
      {
        $match: {
          companyId,
          status: { $in: ['active_rental', 'out_for_delivery', 'ready_for_pickup', 'overdue'] },
        },
      },
      {
        $lookup: {
          from: 'bookingitems',
          localField: '_id',
          foreignField: 'bookingId',
          as: 'items',
        },
      },
      { $unwind: '$items' },
      { $group: { _id: null, qty: { $sum: '$items.quantity' } } },
    ]),
    Booking.countDocuments({
      companyId,
      status: {
        $in: [
          'confirmed',
          'payment_pending',
          'paid',
          'ready_for_pickup',
          'out_for_delivery',
          'active_rental',
          'return_requested',
        ],
      },
    }),
    Booking.countDocuments({ companyId, status: 'pending' }),
    Booking.countDocuments({
      companyId,
      $or: [
        { status: 'overdue' },
        { status: 'active_rental', endDate: { $lt: now } },
      ],
    }),
    Booking.aggregate([
      {
        $match: {
          companyId,
          paymentStatus: 'paid',
          createdAt: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
    ]),
    Booking.aggregate([
      {
        $match: {
          companyId,
          paymentStatus: 'paid',
          createdAt: { $gte: monthStart },
        },
      },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
    ]),
    Booking.aggregate([
      { $match: { companyId, paymentStatus: 'paid' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: '$pricing.totalAmount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]),
    Booking.aggregate([
      { $match: { companyId, createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Product.aggregate([
      { $match: { companyId, status: { $ne: 'archived' } } },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$category.name', 'Uncategorized'] },
          count: { $sum: 1 },
        },
      },
    ]),
    BookingItem.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: '$productId',
          name: { $first: '$productName' },
          totalRentedQty: { $sum: '$quantity' },
          totalRevenue: { $sum: '$lineSubtotal' },
        },
      },
      { $sort: { totalRentedQty: -1 } },
      { $limit: 6 },
    ]),
    Booking.aggregate([
      { $match: { companyId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.find({ companyId })
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(6),
    Booking.find({
      companyId,
      status: { $in: ['active_rental', 'return_requested', 'overdue'] },
    })
      .populate('customerId', 'name email phone')
      .sort({ endDate: 1 })
      .limit(6),
    Product.find({
      companyId,
      status: 'active',
      $expr: { $lte: ['$availableStock', '$lowStockThreshold'] },
    })
      .select('name sku availableStock totalStock lowStockThreshold')
      .limit(8),
    ActivityLog.find({ companyId }).sort({ createdAt: -1 }).limit(8),
  ]);

  res.json({
    success: true,
    data: {
      summary: {
        totalProducts,
        availableProducts,
        currentlyRented: rentedItemsAgg[0]?.qty || 0,
        activeBookings,
        pendingBookings,
        overdueReturns,
        totalRevenue: totalRevenueAgg[0]?.total || 0,
        monthlyRevenue: monthlyRevenueAgg[0]?.total || 0,
      },
      charts: {
        monthlyRevenue: monthlyRevenueSeries.map((r) => ({
          month: r._id,
          revenueMajor: Math.round(r.revenue / 100),
          bookings: r.bookings,
        })),
        bookingTrends: bookingTrendSeries.map((b) => ({
          date: b._id,
          bookings: b.count,
        })),
        categoryDistribution: categoryDist.map((c) => ({
          name: c._id,
          value: c.count,
        })),
        mostRentedProducts: mostRentedProducts.map((p) => ({
          name: p.name,
          rentedQty: p.totalRentedQty,
          revenueMajor: Math.round(p.totalRevenue / 100),
        })),
        bookingStatusDistribution: bookingStatusDist.map((s) => ({
          status: s._id,
          count: s.count,
        })),
      },
      recentBookings,
      upcomingReturns,
      lowStockAlerts: lowStockProducts,
      recentActivities,
    },
  });
}
