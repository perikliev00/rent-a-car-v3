/**
 * Admin pricing settings APIs: seasons, weekend rules, discounts, deposit,
 * delivery/global fees, extras, and a quote preview for validation.
 */
import { api } from '../client';

export interface PriceLine {
  code: string;
  label: string;
  amount: number;
  type: 'base' | 'surcharge' | 'discount' | 'fee' | 'addon' | 'deposit';
}

export interface PriceBreakdown {
  lines: PriceLine[];
  totalPrice: number;
  deposit: number;
  currency: string;
}

export interface PricingSeason {
  id: number;
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  adjType: 'percent' | 'fixed_per_day';
  adjValue: number;
  active: boolean;
}

export interface PricingWeekendRule {
  id: number;
  name: string;
  weekdays: number[];
  adjType: 'percent' | 'fixed_per_day';
  adjValue: number;
  active: boolean;
}

export interface PricingDiscountRule {
  id: number;
  kind: 'long_rental' | 'early_booking' | 'last_minute';
  name: string;
  threshold: number;
  adjType: 'percent' | 'fixed';
  adjValue: number;
  active: boolean;
}

export interface PricingDepositRule {
  id: number;
  name: string;
  defaultAmount: number;
  active: boolean;
}

export interface PricingDeliveryFee {
  locationId: string;
  fee: number;
}

export interface PricingGlobalFee {
  feeKey: string;
  label: string;
  amount: number;
  mode: 'flat' | 'per_day';
  active: boolean;
}

export interface PricingExtra {
  id: number;
  code: string;
  label: string;
  mode: 'flat' | 'per_day';
  amount: number;
  active: boolean;
  sortOrder: number;
}

/** Full pricing config bundle returned by the admin pricing page loader. */
export interface PricingBundle {
  seasons: PricingSeason[];
  weekendRules: PricingWeekendRule[];
  discountRules: PricingDiscountRule[];
  depositRules: PricingDepositRule[];
  deliveryFees: PricingDeliveryFee[];
  deliveryFeeMap: Record<string, number>;
  globalFees: PricingGlobalFee[];
  extras: PricingExtra[];
}

/**
 * Load the full admin pricing configuration bundle.
 */
export async function getAdminPricing(): Promise<{ pricing: PricingBundle }> {
  return api('/api/admin/pricing');
}

/**
 * Replace the delivery-fee table (per location).
 * @param fees - Full set of location delivery fees to persist
 */
export async function updateDeliveryFees(fees: PricingDeliveryFee[]) {
  return api<{ deliveryFees: PricingDeliveryFee[] }>('/api/admin/pricing/delivery-fees', {
    method: 'PUT',
    body: JSON.stringify({ fees }),
  });
}

/**
 * Upsert one global fee by key.
 * @param feeKey - Stable fee key (path segment)
 * @param data - Label/amount and optional other fee fields
 */
export async function updateGlobalFee(
  feeKey: string,
  data: Partial<PricingGlobalFee> & { label: string; amount: number }
) {
  return api<{ globalFee: PricingGlobalFee }>(`/api/admin/pricing/global-fees/${feeKey}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Create a seasonal price adjustment window.
 * @param data - Season fields without id
 */
export async function createSeason(data: Omit<PricingSeason, 'id'>) {
  return api<{ season: PricingSeason }>('/api/admin/pricing/seasons', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing season rule.
 * @param id - Season id
 * @param data - Full season payload without id
 */
export async function updateSeason(id: number, data: Omit<PricingSeason, 'id'>) {
  return api<{ season: PricingSeason }>(`/api/admin/pricing/seasons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a season rule.
 * @param id - Season id
 */
export async function deleteSeason(id: number) {
  return api(`/api/admin/pricing/seasons/${id}`, { method: 'DELETE' });
}

/**
 * Update the weekend surcharge rule (single active rule endpoint).
 * @param data - Partial weekend rule; `adjValue` required
 */
export async function updateWeekend(data: Partial<PricingWeekendRule> & { adjValue: number }) {
  return api<{ weekendRule: PricingWeekendRule }>('/api/admin/pricing/weekend', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Update one discount rule by id.
 * @param id - Discount rule id
 * @param data - Partial discount fields
 */
export async function updateDiscount(id: number, data: Partial<PricingDiscountRule>) {
  return api<{ discountRule: PricingDiscountRule }>(`/api/admin/pricing/discounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Update the deposit rule defaults.
 * @param data - Partial deposit rule; `defaultAmount` required
 */
export async function updateDeposit(data: Partial<PricingDepositRule> & { defaultAmount: number }) {
  return api<{ depositRule: PricingDepositRule }>('/api/admin/pricing/deposit', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Create a bookable extra (addon) price row.
 * @param data - Extra fields without id
 */
export async function createExtra(data: Omit<PricingExtra, 'id'>) {
  return api<{ extra: PricingExtra }>('/api/admin/pricing/extras', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing extra.
 * @param id - Extra id
 * @param data - Partial extra fields
 */
export async function updateExtra(id: number, data: Partial<PricingExtra>) {
  return api<{ extra: PricingExtra }>(`/api/admin/pricing/extras/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete an extra.
 * @param id - Extra id
 */
export async function deleteExtra(id: number) {
  return api(`/api/admin/pricing/extras/${id}`, { method: 'DELETE' });
}

/**
 * Server-side quote preview so admins can verify rule changes without
 * creating an order.
 *
 * @param body - Quote inputs mirroring checkout (car, dates, locations, flags)
 */
export async function previewPricing(body: {
  carId: number;
  pickupDate: string;
  returnDate: string;
  pickupTime?: string;
  returnTime?: string;
  pickupLocation: string;
  returnLocation: string;
  extras?: string[];
  hotelDelivery?: boolean;
  lateReturn?: boolean;
  fuelFee?: boolean;
}) {
  return api<{
    car: { id: number; name: string };
    pricing: {
      lines: PriceLine[];
      totalPrice: number;
      deposit: number;
      rentalDays: number;
      dayPrice: number;
      priceBreakdown: PriceBreakdown;
    };
  }>('/api/admin/pricing/preview', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
