import { AppError } from './errors.js';

const MS_PER_DAY = 86_400_000;

/**
 * Rental Date Boundary Rules:
 * 1. All rental dates are normalized to UTC calendar day boundaries:
 *    - startDate -> 00:00:00.000Z of that calendar date
 *    - endDate   -> 23:59:59.999Z of that calendar date
 * 2. Both startDate and endDate are INCLUSIVE.
 *    For example, Jan 1 to Jan 5 represents 5 rental days (Jan 1, 2, 3, 4, 5).
 *    Jan 1 to Jan 1 is a valid 1-day rental.
 * 3. Two intervals [A.start, A.end] and [B.start, B.end] overlap iff:
 *    A.start <= B.end && A.end >= B.start.
 *    Therefore, Jan 1–5 and Jan 6–8 do NOT overlap, whereas Jan 1–5 and Jan 3–6 DO overlap.
 */
export function normalizeStartOfDayUTC(dateInput: Date | string): Date {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('Invalid start date provided.', 400, 'INVALID_DATE');
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function normalizeEndOfDayUTC(dateInput: Date | string): Date {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('Invalid end date provided.', 400, 'INVALID_DATE');
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function normalizeRentalRange(startInput: Date | string, endInput: Date | string): {
  startDate: Date;
  endDate: Date;
  rentalDays: number;
} {
  const startDate = normalizeStartOfDayUTC(startInput);
  const endDate = normalizeEndOfDayUTC(endInput);

  if (endDate.getTime() < startDate.getTime()) {
    throw new AppError('End date must be on or after start date.', 400, 'INVALID_DATE_RANGE');
  }

  const startDayMs = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );
  const endDayMs = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  const rentalDays = Math.floor((endDayMs - startDayMs) / MS_PER_DAY) + 1;

  return { startDate, endDate, rentalDays };
}

export function toDayKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}
