import { Response } from 'express';
import { ActivityLog } from '../models/ActivityLog.js';
import { Booking } from '../models/Booking.js';
import { Company } from '../models/Company.js';
import { Product } from '../models/Product.js';
import { Subscription } from '../models/Subscription.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { User } from '../models/User.js';
import { logActivity } from '../services/activity.service.js';
import { AuthRequest, SUBSCRIPTION_PLANS, SubscriptionPlanId } from '../types/index.js';
import { AppError } from '../utils/errors.js';

export async function getSuperAdminOverview(_req: AuthRequest, res: Response): Promise<void> {
  const [
    totalCompanies,
    approvedCompanies,
    suspendedCompanies,
    totalUsers,
    totalProducts,
    totalBookings,
    gmvAgg,
    recentCompanies,
    recentLogs,
  ] = await Promise.all([
    Company.countDocuments(),
    Company.countDocuments({ status: 'approved' }),
    Company.countDocuments({ status: 'suspended' }),
    User.countDocuments(),
    Product.countDocuments({ status: { $ne: 'archived' } }),
    Booking.countDocuments(),
    Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, gmv: { $sum: '$pricing.totalAmount' } } },
    ]),
    Company.find()
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10),
    ActivityLog.find().sort({ createdAt: -1 }).limit(15),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        totalCompanies,
        approvedCompanies,
        suspendedCompanies,
        totalUsers,
        totalProducts,
        totalBookings,
        platformGmv: gmvAgg[0]?.gmv || 0,
      },
      recentCompanies,
      recentLogs,
      plans: Object.values(SUBSCRIPTION_PLANS),
    },
  });
}

export async function listAllCompanies(_req: AuthRequest, res: Response): Promise<void> {
  const companies = await Company.find()
    .populate('ownerId', 'name email phone')
    .sort({ createdAt: -1 });

  const subscriptions = await Subscription.find();
  const subMap = new Map(subscriptions.map((s) => [s.companyId.toString(), s]));

  const data = companies.map((c) => ({
    ...c.toObject(),
    subscription: subMap.get(c._id.toString()) || null,
  }));

  res.json({ success: true, data });
}

export async function updateCompanyStatus(req: AuthRequest, res: Response): Promise<void> {
  const { status } = req.body;
  if (!['pending', 'approved', 'suspended'].includes(status)) {
    throw new AppError('Invalid company status.', 400, 'INVALID_STATUS');
  }

  const company = await Company.findByIdAndUpdate(
    req.params.id,
    { $set: { status } },
    { new: true }
  );
  if (!company) throw new AppError('Company not found.', 404, 'NOT_FOUND');

  await logActivity({
    companyId: company._id,
    actorId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: `COMPANY_${status.toUpperCase()}`,
    resourceType: 'Company',
    resourceId: company._id.toString(),
    description: `Super Admin updated ${company.name} status to ${status}`,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: `Company status updated to ${status}.`, data: company });
}

export async function updateCompanySubscriptionByAdmin(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { plan, status } = req.body;
  const sub = await Subscription.findOne({ companyId: req.params.id });
  if (!sub) throw new AppError('Subscription not found.', 404, 'NOT_FOUND');

  if (plan && SUBSCRIPTION_PLANS[plan as SubscriptionPlanId]) {
    sub.plan = plan;
    sub.priceInSmallestUnit = SUBSCRIPTION_PLANS[plan as SubscriptionPlanId].monthlyPriceInSmallestUnit;
  }
  if (status) sub.status = status;
  await sub.save();

  res.json({ success: true, message: 'Subscription updated.', data: sub });
}

export async function listPlatformSupportTickets(_req: AuthRequest, res: Response): Promise<void> {
  const tickets = await SupportTicket.find()
    .populate('customerId', 'name email')
    .populate('companyId', 'name companyCode')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: tickets });
}
