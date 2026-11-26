import { z } from 'zod';

const cartLineSchema = z.object({
  productId: z.string().min(10),
  quantity: z.number().int().min(1).max(500),
});

export const checkAvailabilitySchema = z.object({
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  items: z.array(cartLineSchema).min(1),
  fulfillmentType: z.enum(['pickup', 'delivery']).optional().default('pickup'),
  discountAmount: z.number().int().min(0).optional().default(0),
});

export const createBookingSchema = z.object({
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  items: z.array(cartLineSchema).min(1),
  fulfillmentType: z.enum(['pickup', 'delivery']).default('pickup'),
  deliveryAddress: z
    .object({
      label: z.string().optional(),
      street: z.string().min(2),
      city: z.string().min(2),
      state: z.string().min(2),
      postalCode: z.string().min(3),
      country: z.string().default('India'),
      phone: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional(),
  notes: z.string().max(1000).optional(),
  asHold: z.boolean().optional().default(false),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'payment_pending',
    'paid',
    'ready_for_pickup',
    'out_for_delivery',
    'active_rental',
    'return_requested',
    'returned',
    'completed',
    'cancelled',
    'rejected',
    'overdue',
  ]),
  note: z.string().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const extensionSchema = z.object({
  action: z.enum(['request', 'approve', 'reject']).default('request'),
  requestedEndDate: z.string().optional(),
  reason: z.string().max(500).optional(),
});
