/**
 * Decimal-safe monetary calculations.
 * All monetary amounts in RentFlow are stored as integer smallest currency units
 * (e.g., paise for INR, cents for USD). 100 smallest units = 1 major unit.
 */

export function toSmallestUnit(majorAmount: number): number {
  return Math.round(Number(majorAmount) * 100);
}

export function toMajorUnit(smallestUnitAmount: number): number {
  return Math.round(smallestUnitAmount) / 100;
}

export function calculatePercentage(amountInSmallestUnit: number, ratePercent: number): number {
  return Math.round((amountInSmallestUnit * ratePercent) / 100);
}

export function formatMoney(
  smallestUnitAmount: number,
  currencySymbol = '₹',
  currencyCode = 'INR'
): string {
  const major = toMajorUnit(smallestUnitAmount);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currencySymbol}${major.toFixed(2)}`;
  }
}
