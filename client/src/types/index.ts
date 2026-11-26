export type UserRole =
  | 'super_admin'
  | 'company_owner'
  | 'company_admin'
  | 'rental_staff'
  | 'customer';

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

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string;
  isEmailVerified: boolean;
  companyId?: string;
  companyRole?: 'company_owner' | 'company_admin' | 'rental_staff';
}

export interface CompanySettings {
  currency: string;
  currencySymbol: string;
  taxEnabled: boolean;
  taxRate: number;
  taxInclusive: boolean;
  gstNumber?: string;
  deliveryEnabled: boolean;
  defaultDeliveryFee: number;
  lateFeePerDayPercent: number;
  securityDepositRequired: boolean;
  cancellationWindowHours: number;
  minRentalDays: number;
  maxRentalDays: number;
  bookingHoldMinutes: number;
  allowExtensions: boolean;
  termsAndConditions?: string;
}

export interface Company {
  _id: string;
  name: string;
  slug: string;
  companyCode: string;
  businessType: string;
  description?: string;
  email: string;
  phone: string;
  website?: string;
  logoUrl?: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    lat?: number;
    lng?: number;
  };
  status: 'pending' | 'approved' | 'suspended';
  onboardingCompleted: boolean;
  onboardingStep: number;
  settings: CompanySettings;
}

export interface Subscription {
  _id: string;
  companyId: string;
  plan: 'starter' | 'professional' | 'business';
  status: 'active' | 'trialing' | 'past_due' | 'cancelled';
  mode: 'dev_simulated' | 'live';
  billingCycle: 'monthly' | 'annual';
  priceInSmallestUnit: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  billingHistory: Array<{
    invoiceRef: string;
    plan: string;
    billingCycle: string;
    amountInSmallestUnit: number;
    status: string;
    mode: string;
    paidAt: string;
  }>;
}

export interface Category {
  _id: string;
  companyId: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  icon?: string;
  active: boolean;
}

export interface Product {
  _id: string;
  companyId: string | Company;
  categoryId: string | Category;
  subcategoryId?: string | Category;
  name: string;
  sku: string;
  description: string;
  images: string[];
  brand?: string;
  model?: string;
  pricePerDay: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  securityDeposit: number;
  totalStock: number;
  availableStock: number;
  condition: 'new' | 'excellent' | 'good' | 'fair';
  location?: string;
  status: 'active' | 'inactive' | 'maintenance' | 'archived';
  averageRating: number;
  reviewCount: number;
  createdAt: string;
}

export interface PriceBreakdown {
  rentalDays: number;
  rentalSubtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxRate: number;
  taxInclusive: boolean;
  taxAmount: number;
  deliveryFee: number;
  securityDeposit: number;
  totalAmount: number;
}

export interface Booking {
  _id: string;
  bookingReference: string;
  companyId: Company | string;
  customerId: User | string;
  startDate: string;
  endDate: string;
  rentalDays: number;
  status: BookingStatus;
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed';
  fulfillmentType: 'pickup' | 'delivery';
  deliveryAddress?: {
    label?: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  pricing: PriceBreakdown & {
    lateFeeAmount?: number;
    damageFeeAmount?: number;
  };
  items?: Array<{
    _id: string;
    productId: Product | string;
    productName: string;
    productSku: string;
    quantity: number;
    unitDailyPrice: number;
    lineSubtotal: number;
    depositPerUnit: number;
  }>;
  statusHistory: Array<{
    status: string;
    note?: string;
    changedByName?: string;
    changedAt: string;
  }>;
  notes?: string;
  holdExpiresAt?: string;
  createdAt: string;
}
