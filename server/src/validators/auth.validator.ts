import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password is too long')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter')
  .regex(/[0-9]/, 'Password must include at least one number');

export const registerCustomerSchema = z
  .object({
    accountType: z.literal('customer').optional().default('customer'),
    name: z.string().min(2, 'Full name is required').max(120),
    email: z.string().email('Valid email is required').toLowerCase(),
    phone: z.string().min(7, 'Valid phone number is required').max(20),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const registerCompanySchema = z
  .object({
    accountType: z.literal('company'),
    ownerName: z.string().min(2, 'Owner name is required').max(120),
    companyName: z.string().min(2, 'Company name is required').max(150),
    email: z.string().email('Valid business email is required').toLowerCase(),
    phone: z.string().min(7, 'Valid phone number is required').max(20),
    password: passwordSchema,
    confirmPassword: z.string(),
    businessType: z.string().min(2, 'Business type is required').max(100),
    businessAddress: z.object({
      street: z.string().min(2, 'Street address is required'),
      city: z.string().min(2, 'City is required'),
      state: z.string().min(2, 'State is required'),
      country: z.string().min(2, 'Country is required').default('India'),
      postalCode: z.string().min(3, 'Postal code is required'),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const registerUnifiedSchema = z.union([registerCompanySchema, registerCustomerSchema]);

export const loginSchema = z.object({
  email: z.string().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required').toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const verifyEmailSchema = z.object({
  token: z.string().min(10, 'Verification token is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(7).max(20).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});
