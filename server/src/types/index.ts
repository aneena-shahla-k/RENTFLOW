import { Request } from 'express';
import { Types } from 'mongoose';

export type UserRole =
  | 'super_admin'
  | 'company_owner'
  | 'company_admin'
  | 'rental_staff'
  | 'customer';

export type CompanyStaffRole = 'company_owner' | 'company_admin' | 'rental_staff';

export type BookingStatus =
  | 'hold'
  | 'pending'
  | 'confirmed'
  | 'payment_pending'
  | 'paid'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'active_rental'
  | 'return_requested'
  | 'returned'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'overdue';

export type SubscriptionPlanId = 'starter' | 'professional' | 'business';

export interface PlanDefinition {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  monthlyPriceInSmallestUnit: number;
  annualPriceInSmallestUnit: number;
  limits: {
    maxProducts: number;
    maxStaff: number;
    maxBookingsPerMonth: number;
    analyticsEnabled: boolean;
    emailNotificationsEnabled: boolean;
    multipleLocations: boolean;
    prioritySupport: boolean;
  };
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'Essential tools for growing local rental shops',
    monthlyPriceInSmallestUnit: 199900, // ₹1,999 / mo
    annualPriceInSmallestUnit: 1999000,
    limits: {
      maxProducts: 25,
      maxStaff: 2,
      maxBookingsPerMonth: 100,
      analyticsEnabled: false,
      emailNotificationsEnabled: false,
      multipleLocations: false,
      prioritySupport: false,
    },
    features: [
      'Up to 25 rental products',
      'Up to 100 bookings per month',
      'Up to 2 team members',
      'Date conflict & availability engine',
      'Basic operational dashboard',
      'Invoice PDF generation',
    ],
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    tagline: 'Advanced workflows for established rental operators',
    monthlyPriceInSmallestUnit: 499900, // ₹4,999 / mo
    annualPriceInSmallestUnit: 4999000,
    limits: {
      maxProducts: 200,
      maxStaff: 10,
      maxBookingsPerMonth: 1000,
      analyticsEnabled: true,
      emailNotificationsEnabled: true,
      multipleLocations: false,
      prioritySupport: false,
    },
    features: [
      'Up to 200 rental products',
      'Up to 1,000 bookings per month',
      'Up to 10 team members',
      'Advanced revenue & utilization reports',
      'Automated email notifications',
      'Delivery & return inspection workflows',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    tagline: 'Enterprise scale for multi-branch rental fleets',
    monthlyPriceInSmallestUnit: 999900, // ₹9,999 / mo
    annualPriceInSmallestUnit: 9999000,
    limits: {
      maxProducts: 5000,
      maxStaff: 100,
      maxBookingsPerMonth: 25000,
      analyticsEnabled: true,
      emailNotificationsEnabled: true,
      multipleLocations: true,
      prioritySupport: true,
    },
    features: [
      'Up to 5,000 rental products',
      'Up to 25,000 bookings per month',
      'Up to 100 team members',
      'Multi-location inventory support',
      'Executive analytics & CSV/PDF exports',
      'Priority customer support SLA',
    ],
  },
};

export interface AuthenticatedUser {
  _id: Types.ObjectId;
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: Types.ObjectId;
  companyRole?: CompanyStaffRole;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  companyId?: Types.ObjectId;
  companyMembership?: {
    _id: Types.ObjectId;
    role: CompanyStaffRole;
    permissions: string[];
  };
}
