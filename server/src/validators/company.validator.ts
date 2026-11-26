import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(2).max(150),
  businessType: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  phone: z.string().min(7).max(20),
  description: z.string().max(1000).optional(),
  website: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(150).optional(),
  businessType: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional(),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().min(7).max(20).optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
  onboardingStep: z.number().int().min(1).max(8).optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional(),
  settings: z
    .object({
      currency: z.string().min(3).max(5).optional(),
      currencySymbol: z.string().min(1).max(5).optional(),
      taxEnabled: z.boolean().optional(),
      taxRate: z.number().min(0).max(50).optional(),
      taxInclusive: z.boolean().optional(),
      gstNumber: z.string().max(30).optional(),
      deliveryEnabled: z.boolean().optional(),
      defaultDeliveryFee: z.number().int().min(0).optional(),
      lateFeePerDayPercent: z.number().min(0).max(200).optional(),
      securityDepositRequired: z.boolean().optional(),
      cancellationWindowHours: z.number().int().min(0).optional(),
      minRentalDays: z.number().int().min(1).optional(),
      maxRentalDays: z.number().int().min(1).max(365).optional(),
      bookingHoldMinutes: z.number().int().min(5).max(120).optional(),
      allowExtensions: z.boolean().optional(),
      termsAndConditions: z.string().max(5000).optional(),
    })
    .optional(),
});

export const inviteStaffSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().toLowerCase(),
  phone: z.string().min(7).max(20).optional(),
  role: z.enum(['company_admin', 'rental_staff']),
  password: z.string().min(8).max(100).optional(),
});

export const updateStaffSchema = z.object({
  role: z.enum(['company_admin', 'rental_staff']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  permissions: z.array(z.string()).optional(),
});
