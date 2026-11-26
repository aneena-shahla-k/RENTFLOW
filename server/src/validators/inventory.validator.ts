import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  parentId: z.string().nullable().optional(),
  icon: z.string().max(50).optional(),
  active: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createProductSchema = z.object({
  name: z.string().min(2).max(180),
  sku: z.string().min(2).max(60),
  categoryId: z.string().min(10),
  subcategoryId: z.string().nullable().optional(),
  description: z.string().min(5).max(4000),
  images: z.array(z.string()).optional(),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  pricePerDay: z.number().int().min(0),
  pricePerWeek: z.number().int().min(0).optional(),
  pricePerMonth: z.number().int().min(0).optional(),
  securityDeposit: z.number().int().min(0).default(0),
  totalStock: z.number().int().min(0),
  availableStock: z.number().int().min(0).optional(),
  condition: z.enum(['new', 'excellent', 'good', 'fair']).default('excellent'),
  location: z.string().max(120).optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'archived']).default('active'),
  lowStockThreshold: z.number().int().min(0).default(2),
});

export const updateProductSchema = createProductSchema.partial();

export const bulkProductStatusSchema = z.object({
  productIds: z.array(z.string().min(10)).min(1),
  status: z.enum(['active', 'inactive', 'maintenance', 'archived']),
});

export const createMaintenanceSchema = z.object({
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  quantityBlocked: z.number().int().min(1),
  reason: z.string().min(3).max(500),
});
