import { ICompanySettings } from '../models/Company.js';
import { IProduct } from '../models/Product.js';
import { calculatePercentage } from '../utils/money.js';

export interface LinePricingInput {
  product: Pick<
    IProduct,
    'pricePerDay' | 'pricePerWeek' | 'pricePerMonth' | 'securityDeposit'
  >;
  quantity: number;
  rentalDays: number;
}

export interface CalculatedBookingPricing {
  rentalDays: number;
  rentalSubtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxRate: number;
  taxInclusive: boolean;
  taxAmount: number;
  deliveryFee: number;
  securityDeposit: number;
  lateFeeAmount: number;
  damageFeeAmount: number;
  totalAmount: number;
  itemSubtotals: number[];
}

/**
 * Computes unit rental subtotal for a given duration.
 * Uses optimal monthly/weekly tiers when configured, otherwise daily rate.
 */
export function calculateProductLineSubtotal(
  product: Pick<IProduct, 'pricePerDay' | 'pricePerWeek' | 'pricePerMonth'>,
  rentalDays: number,
  quantity: number
): number {
  let remainingDays = rentalDays;
  let unitAmount = 0;

  if (product.pricePerMonth && product.pricePerMonth > 0 && remainingDays >= 30) {
    const months = Math.floor(remainingDays / 30);
    unitAmount += months * product.pricePerMonth;
    remainingDays = remainingDays % 30;
  }

  if (product.pricePerWeek && product.pricePerWeek > 0 && remainingDays >= 7) {
    const weeks = Math.floor(remainingDays / 7);
    unitAmount += weeks * product.pricePerWeek;
    remainingDays = remainingDays % 7;
  }

  unitAmount += remainingDays * product.pricePerDay;

  // Ensure multi-tier rate never exceeds pure daily rate
  const pureDaily = product.pricePerDay * rentalDays;
  const bestUnitAmount = Math.min(unitAmount, pureDaily);

  return bestUnitAmount * quantity;
}

export function calculateBookingPricing(params: {
  items: LinePricingInput[];
  settings: ICompanySettings;
  fulfillmentType: 'pickup' | 'delivery';
  discountAmount?: number;
  customDeliveryFee?: number;
}): CalculatedBookingPricing {
  const rentalDays = params.items[0]?.rentalDays || 1;
  const itemSubtotals = params.items.map((item) =>
    calculateProductLineSubtotal(item.product, item.rentalDays, item.quantity)
  );

  const rentalSubtotal = itemSubtotals.reduce((sum, v) => sum + v, 0);
  const discountAmount = Math.min(Math.max(0, params.discountAmount || 0), rentalSubtotal);

  const securityDeposit = params.settings.securityDepositRequired
    ? params.items.reduce(
        (sum, item) => sum + (item.product.securityDeposit || 0) * item.quantity,
        0
      )
    : 0;

  const deliveryFee =
    params.fulfillmentType === 'delivery' && params.settings.deliveryEnabled
      ? params.customDeliveryFee ?? params.settings.defaultDeliveryFee ?? 0
      : 0;

  const netRental = rentalSubtotal - discountAmount;
  const taxRate = params.settings.taxEnabled ? params.settings.taxRate : 0;
  const taxInclusive = Boolean(params.settings.taxInclusive);

  let taxableAmount = netRental + deliveryFee;
  let taxAmount = 0;

  if (taxRate > 0) {
    if (taxInclusive) {
      // Back-out tax from inclusive gross amount
      taxableAmount = Math.round((netRental + deliveryFee) / (1 + taxRate / 100));
      taxAmount = netRental + deliveryFee - taxableAmount;
    } else {
      taxableAmount = netRental + deliveryFee;
      taxAmount = calculatePercentage(taxableAmount, taxRate);
    }
  }

  const totalAmount = taxInclusive
    ? netRental + deliveryFee + securityDeposit
    : netRental + deliveryFee + taxAmount + securityDeposit;

  return {
    rentalDays,
    rentalSubtotal,
    discountAmount,
    taxableAmount,
    taxRate,
    taxInclusive,
    taxAmount,
    deliveryFee,
    securityDeposit,
    lateFeeAmount: 0,
    damageFeeAmount: 0,
    totalAmount,
    itemSubtotals,
  };
}
