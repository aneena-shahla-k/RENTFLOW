import crypto from 'crypto';
import { Response } from 'express';
import { Booking } from '../models/Booking.js';
import { CompanyMembership } from '../models/CompanyMembership.js';
import { Product } from '../models/Product.js';
import { Subscription } from '../models/Subscription.js';
import { AuthRequest, SUBSCRIPTION_PLANS, SubscriptionPlanId } from '../types/index.js';
import { AppError } from '../utils/errors.js';

export async function getSubscriptionStatus(req: AuthRequest, res: Response): Promise<void> {
  const companyId = req.companyId!;
  let subscription = await Subscription.findOne({ companyId });

  if (!subscription) {
    subscription = await Subscription.create({
      companyId,
      plan: 'starter',
      status: 'trialing',
      mode: 'dev_simulated',
      billingCycle: 'monthly',
      priceInSmallestUnit: SUBSCRIPTION_PLANS.starter.monthlyPriceInSmallestUnit,
    });
  }

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const [productsUsed, staffUsed, monthlyBookingsUsed] = await Promise.all([
    Product.countDocuments({ companyId, status: { $ne: 'archived' } }),
    CompanyMembership.countDocuments({ companyId, status: 'active' }),
    Booking.countDocuments({ companyId, createdAt: { $gte: monthStart }, status: { $ne: 'cancelled' } }),
  ]);

  const activePlan = SUBSCRIPTION_PLANS[subscription.plan];

  res.json({
    success: true,
    data: {
      subscription,
      currentPlan: activePlan,
      availablePlans: Object.values(SUBSCRIPTION_PLANS),
      usage: {
        productsUsed,
        maxProducts: activePlan.limits.maxProducts,
        staffUsed,
        maxStaff: activePlan.limits.maxStaff,
        monthlyBookingsUsed,
        maxBookingsPerMonth: activePlan.limits.maxBookingsPerMonth,
      },
      notice:
        'Development Subscription Mode: Plan changes are simulated locally and do not charge real cards.',
    },
  });
}

export async function changeSubscriptionPlan(req: AuthRequest, res: Response): Promise<void> {
  if (req.user?.companyRole !== 'company_owner') {
    throw new AppError('Only the Company Owner can change subscription plans.', 403, 'FORBIDDEN');
  }

  const { plan, billingCycle = 'monthly' } = req.body as {
    plan: SubscriptionPlanId;
    billingCycle?: 'monthly' | 'annual';
  };

  const def = SUBSCRIPTION_PLANS[plan];
  if (!def) {
    throw new AppError('Invalid subscription plan selected.', 400, 'INVALID_PLAN');
  }

  const amount =
    billingCycle === 'annual' ? def.annualPriceInSmallestUnit : def.monthlyPriceInSmallestUnit;
  const periodDays = billingCycle === 'annual' ? 365 : 30;

  let subscription = await Subscription.findOne({ companyId: req.companyId });
  if (!subscription) {
    subscription = new Subscription({ companyId: req.companyId });
  }

  subscription.plan = plan;
  subscription.billingCycle = billingCycle;
  subscription.status = 'active';
  subscription.mode = 'dev_simulated';
  subscription.priceInSmallestUnit = amount;
  subscription.currentPeriodStart = new Date();
  subscription.currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
  subscription.billingHistory.unshift({
    invoiceRef: `SUB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    plan,
    billingCycle,
    amountInSmallestUnit: amount,
    status: 'paid',
    mode: 'dev_simulated',
    paidAt: new Date(),
  });

  await subscription.save();

  res.json({
    success: true,
    message: `Switched to ${def.name} plan (Development Subscription Mode).`,
    data: subscription,
  });
}
