import mongoose, { ClientSession, Types } from 'mongoose';
import { supportsTransactions } from '../config/database.js';
import { Booking } from '../models/Booking.js';
import { BookingItem } from '../models/BookingItem.js';
import { MaintenancePeriod } from '../models/MaintenancePeriod.js';
import { Product } from '../models/Product.js';
import { BookingStatus } from '../types/index.js';
import { normalizeRentalRange } from '../utils/dateRange.js';
import { AppError } from '../utils/errors.js';

export const RESERVING_BOOKING_STATUSES: BookingStatus[] = [
  'hold',
  'pending',
  'confirmed',
  'payment_pending',
  'paid',
  'ready_for_pickup',
  'out_for_delivery',
  'active_rental',
  'return_requested',
  'overdue',
];

const MS_PER_DAY = 86_400_000;

function toUtcDayIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY
  );
}

/**
 * Simple in-process async mutex queue keyed by productId to serialize simultaneous
 * availability-check + reservation mutations cleanly without deadlocks.
 */
const lockChains = new Map<string, Promise<void>>();

async function acquireLock(key: string): Promise<() => void> {
  const previous = lockChains.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  lockChains.set(key, chained);

  await previous;

  return () => {
    release();
    if (lockChains.get(key) === chained) {
      lockChains.delete(key);
    }
  };
}

export async function withProductLocks<T>(
  productIds: string[],
  fn: (session?: ClientSession) => Promise<T>
): Promise<T> {
  const uniqueSorted = Array.from(new Set(productIds)).sort();
  const releases: Array<() => void> = [];

  try {
    for (const id of uniqueSorted) {
      releases.push(await acquireLock(id));
    }

    if (supportsTransactions()) {
      const session = await mongoose.startSession();
      try {
        let output!: T;
        await session.withTransaction(async () => {
          output = await fn(session);
        });
        return output;
      } finally {
        await session.endSession();
      }
    }

    return await fn(undefined);
  } finally {
    for (let i = releases.length - 1; i >= 0; i--) {
      releases[i]();
    }
  }
}

export async function releaseExpiredHolds(session?: ClientSession): Promise<number> {
  const now = new Date();
  const result = await Booking.updateMany(
    {
      status: 'hold',
      holdExpiresAt: { $lte: now },
    },
    {
      $set: {
        status: 'cancelled',
        cancellationReason: 'Temporary booking hold expired automatically.',
      },
      $push: {
        statusHistory: {
          status: 'cancelled',
          note: 'Temporary hold expired automatically',
          changedByName: 'System',
          changedAt: now,
        },
      },
    },
    session ? { session } : undefined
  );
  return result.modifiedCount || 0;
}

export interface ProductAvailabilityResult {
  productId: string;
  productName: string;
  totalStock: number;
  maxReservedInRange: number;
  maintenanceBlocked: number;
  availableQuantity: number;
  requestedQuantity: number;
  isAvailable: boolean;
  reason?: string;
}

export async function checkProductAvailabilityForRange(params: {
  productId: Types.ObjectId | string;
  startDate: Date | string;
  endDate: Date | string;
  requestedQuantity?: number;
  excludeBookingId?: Types.ObjectId | string;
  session?: ClientSession;
}): Promise<ProductAvailabilityResult> {
  const { startDate, endDate } = normalizeRentalRange(params.startDate, params.endDate);
  const requestedQuantity = params.requestedQuantity ?? 1;

  await releaseExpiredHolds(params.session);

  const productQuery = Product.findById(params.productId);
  if (params.session) productQuery.session(params.session);
  const product = await productQuery;

  if (!product) {
    throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  }

  if (product.status !== 'active') {
    return {
      productId: product._id.toString(),
      productName: product.name,
      totalStock: product.totalStock,
      maxReservedInRange: product.totalStock,
      maintenanceBlocked: 0,
      availableQuantity: 0,
      requestedQuantity,
      isAvailable: false,
      reason: `Product is currently ${product.status} and unavailable for rent.`,
    };
  }

  const reqStartDay = toUtcDayIndex(startDate);
  const reqEndDay = toUtcDayIndex(endDate);
  const now = new Date();

  // 1. Find overlapping BookingItems for this product
  const itemQuery = BookingItem.find({
    productId: product._id,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
    ...(params.excludeBookingId ? { bookingId: { $ne: params.excludeBookingId } } : {}),
  }).populate({
    path: 'bookingId',
    select: 'status holdExpiresAt',
  });
  if (params.session) itemQuery.session(params.session);
  const overlappingItems = await itemQuery;

  // 2. Find overlapping MaintenancePeriods
  const maintQuery = MaintenancePeriod.find({
    productId: product._id,
    status: { $in: ['scheduled', 'in_progress'] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
  if (params.session) maintQuery.session(params.session);
  const overlappingMaintenance = await maintQuery;

  // Sweep-line events: [dayIndex, delta]
  const bookingEvents: Array<[number, number]> = [];
  for (const item of overlappingItems) {
    const parent = item.bookingId as unknown as { status?: BookingStatus; holdExpiresAt?: Date } | null;
    if (!parent || !parent.status) continue;
    if (!RESERVING_BOOKING_STATUSES.includes(parent.status)) continue;
    if (parent.status === 'hold' && parent.holdExpiresAt && parent.holdExpiresAt <= now) {
      continue;
    }

    const sDay = Math.max(reqStartDay, toUtcDayIndex(item.startDate));
    const eDay = Math.min(reqEndDay, toUtcDayIndex(item.endDate));
    if (sDay <= eDay) {
      bookingEvents.push([sDay, item.quantity]);
      bookingEvents.push([eDay + 1, -item.quantity]);
    }
  }

  const maintEvents: Array<[number, number]> = [];
  for (const m of overlappingMaintenance) {
    const sDay = Math.max(reqStartDay, toUtcDayIndex(m.startDate));
    const eDay = Math.min(reqEndDay, toUtcDayIndex(m.endDate));
    if (sDay <= eDay) {
      maintEvents.push([sDay, m.quantityBlocked]);
      maintEvents.push([eDay + 1, -m.quantityBlocked]);
    }
  }

  const computePeak = (events: Array<[number, number]>): number => {
    if (events.length === 0) return 0;
    events.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
    let curr = 0;
    let peak = 0;
    for (const [, delta] of events) {
      curr += delta;
      if (curr > peak) peak = curr;
    }
    return peak;
  };

  const combinedEvents = [...bookingEvents, ...maintEvents];
  const maxReservedTotal = computePeak(combinedEvents);
  const maxMaintenance = computePeak(maintEvents);
  const availableQuantity = Math.max(0, product.totalStock - maxReservedTotal);
  const isAvailable = availableQuantity >= requestedQuantity && requestedQuantity > 0;

  return {
    productId: product._id.toString(),
    productName: product.name,
    totalStock: product.totalStock,
    maxReservedInRange: maxReservedTotal,
    maintenanceBlocked: maxMaintenance,
    availableQuantity,
    requestedQuantity,
    isAvailable,
    reason: isAvailable
      ? undefined
      : `Only ${availableQuantity} unit(s) of ${product.name} available for the selected dates.`,
  };
}
