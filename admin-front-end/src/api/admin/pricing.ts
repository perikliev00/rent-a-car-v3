/**
 * Admin pricing settings APIs: seasons, weekend rules, discounts, deposit,
 * delivery/global fees, extras, and a quote preview for validation.
 */
import { api } from '../client';

// Export the price line interface.
export interface PriceLine {
  // Provide the code field value.
  code: string;
  // Provide the label field value.
  label: string;
  // Provide the amount field value.
  amount: number;
  // Provide the type field value.
  type: 'base' | 'surcharge' | 'discount' | 'fee' | 'addon' | 'deposit';
}

// Export the price breakdown interface.
export interface PriceBreakdown {
  // Provide the lines field value.
  lines: PriceLine[];
  // Provide the total price field value.
  totalPrice: number;
  // Provide the deposit field value.
  deposit: number;
  // Provide the currency field value.
  currency: string;
}

// Export the pricing season interface.
export interface PricingSeason {
  // Provide the id field value.
  id: number;
  // Provide the name field value.
  name: string;
  // Provide the start month field value.
  startMonth: number;
  // Provide the start day field value.
  startDay: number;
  // Provide the end month field value.
  endMonth: number;
  // Provide the end day field value.
  endDay: number;
  // Provide the adj type field value.
  adjType: 'percent' | 'fixed_per_day';
  // Provide the adj value field value.
  adjValue: number;
  // Provide the active field value.
  active: boolean;
}

// Export the pricing weekend rule interface.
export interface PricingWeekendRule {
  // Provide the id field value.
  id: number;
  // Provide the name field value.
  name: string;
  // Provide the weekdays field value.
  weekdays: number[];
  // Provide the adj type field value.
  adjType: 'percent' | 'fixed_per_day';
  // Provide the adj value field value.
  adjValue: number;
  // Provide the active field value.
  active: boolean;
}

// Export the pricing discount rule interface.
export interface PricingDiscountRule {
  // Provide the id field value.
  id: number;
  // Provide the kind field value.
  kind: 'long_rental' | 'early_booking' | 'last_minute';
  // Provide the name field value.
  name: string;
  // Provide the threshold field value.
  threshold: number;
  // Provide the adj type field value.
  adjType: 'percent' | 'fixed';
  // Provide the adj value field value.
  adjValue: number;
  // Provide the active field value.
  active: boolean;
}

// Export the pricing deposit rule interface.
export interface PricingDepositRule {
  // Provide the id field value.
  id: number;
  // Provide the name field value.
  name: string;
  // Provide the default amount field value.
  defaultAmount: number;
  // Provide the active field value.
  active: boolean;
}

// Export the pricing delivery fee interface.
export interface PricingDeliveryFee {
  // Provide the location id field value.
  locationId: string;
  // Provide the fee field value.
  fee: number;
}

// Export the pricing global fee interface.
export interface PricingGlobalFee {
  // Provide the fee key field value.
  feeKey: string;
  // Provide the label field value.
  label: string;
  // Provide the amount field value.
  amount: number;
  // Provide the mode field value.
  mode: 'flat' | 'per_day';
  // Provide the active field value.
  active: boolean;
}

// Export the pricing extra interface.
export interface PricingExtra {
  // Provide the id field value.
  id: number;
  // Provide the code field value.
  code: string;
  // Provide the label field value.
  label: string;
  // Provide the mode field value.
  mode: 'flat' | 'per_day';
  // Provide the amount field value.
  amount: number;
  // Provide the active field value.
  active: boolean;
  // Provide the sort order field value.
  sortOrder: number;
}

/** Full pricing config bundle returned by the admin pricing page loader. */
export interface PricingBundle {
  // Provide the seasons field value.
  seasons: PricingSeason[];
  // Provide the weekend rules field value.
  weekendRules: PricingWeekendRule[];
  // Provide the discount rules field value.
  discountRules: PricingDiscountRule[];
  // Provide the deposit rules field value.
  depositRules: PricingDepositRule[];
  // Provide the delivery fees field value.
  deliveryFees: PricingDeliveryFee[];
  // Provide the delivery fee map field value.
  deliveryFeeMap: Record<string, number>;
  // Provide the global fees field value.
  globalFees: PricingGlobalFee[];
  // Provide the extras field value.
  extras: PricingExtra[];
}

/**
 * Load the full admin pricing configuration bundle.
 */
export async function getAdminPricing(): Promise<{ pricing: PricingBundle }> {
  // Return the resulting value to the caller.
  return api('/api/admin/pricing');
}

/**
 * Replace the delivery-fee table (per location).
 * @param fees - Full set of location delivery fees to persist
 */
export async function updateDeliveryFees(fees: PricingDeliveryFee[]) {
  // Return the resulting value to the caller.
  return api<{ deliveryFees: PricingDeliveryFee[] }>('/api/admin/pricing/delivery-fees', {
    // Provide the method field value.
    method: 'PUT',
    // Provide the body field value.
    body: JSON.stringify({ fees }),
  });
}

/**
 * Upsert one global fee by key.
 * @param feeKey - Stable fee key (path segment)
 * @param data - Label/amount and optional other fee fields
 */
export async function updateGlobalFee(
  // Provide the fee key field value.
  feeKey: string,
  // Provide the data field value.
  data: Partial<PricingGlobalFee> & { label: string; amount: number }
// Continue the surrounding logic with this statement.
) {
  // Return the resulting value to the caller.
  return api<{ globalFee: PricingGlobalFee }>(`/api/admin/pricing/global-fees/${feeKey}`, {
    // Provide the method field value.
    method: 'PUT',
    // Provide the body field value.
    body: JSON.stringify(data),
  });
}

/**
 * Create a seasonal price adjustment window.
 * @param data - Season fields without id
 */
export async function createSeason(data: Omit<PricingSeason, 'id'>) {
  // Return the resulting value to the caller.
  return api<{ season: PricingSeason }>('/api/admin/pricing/seasons', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing season rule.
 * @param id - Season id
 * @param data - Full season payload without id
 */
export async function updateSeason(id: number, data: Omit<PricingSeason, 'id'>) {
  // Return the resulting value to the caller.
  return api<{ season: PricingSeason }>(`/api/admin/pricing/seasons/${id}`, {
    // Provide the method field value.
    method: 'PUT',
    // Provide the body field value.
    body: JSON.stringify(data),
  });
}

/**
 * Delete a season rule.
 * @param id - Season id
 */
export async function deleteSeason(id: number) {
  // Return the resulting value to the caller.
  return api(`/api/admin/pricing/seasons/${id}`, { method: 'DELETE' });
}

/**
 * Update the weekend surcharge rule (single active rule endpoint).
 * @param data - Partial weekend rule; `adjValue` required
 */
export async function updateWeekend(data: Partial<PricingWeekendRule> & { adjValue: number }) {
  // Return the resulting value to the caller.
  return api<{ weekendRule: PricingWeekendRule }>('/api/admin/pricing/weekend', {
    // Provide the method field value.
    method: 'PUT',
    // Provide the body field value.
    body: JSON.stringify(data),
  });
}

/**
 * Update one discount rule by id.
 * @param id - Discount rule id
 * @param data - Partial discount fields
 */
export async function updateDiscount(id: number, data: Partial<PricingDiscountRule>) {
  // Return the resulting value to the caller.
  return api<{ discountRule: PricingDiscountRule }>(`/api/admin/pricing/discounts/${id}`, {
    // Provide the method field value.
    method: 'PUT',
    // Provide the body field value.
    body: JSON.stringify(data),
  });
}

/**
 * Update the deposit rule defaults.
 * @param data - Partial deposit rule; `defaultAmount` required
 */
export async function updateDeposit(data: Partial<PricingDepositRule> & { defaultAmount: number }) {
  // Return the resulting value to the caller.
  return api<{ depositRule: PricingDepositRule }>('/api/admin/pricing/deposit', {
    // Provide the method field value.
    method: 'PUT',
    // Provide the body field value.
    body: JSON.stringify(data),
  });
}

/**
 * Create a bookable extra (addon) price row.
 * @param data - Extra fields without id
 */
export async function createExtra(data: Omit<PricingExtra, 'id'>) {
  // Return the resulting value to the caller.
  return api<{ extra: PricingExtra }>('/api/admin/pricing/extras', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing extra.
 * @param id - Extra id
 * @param data - Partial extra fields
 */
export async function updateExtra(id: number, data: Partial<PricingExtra>) {
  // Return the resulting value to the caller.
  return api<{ extra: PricingExtra }>(`/api/admin/pricing/extras/${id}`, {
    // Provide the method field value.
    method: 'PUT',
    // Provide the body field value.
    body: JSON.stringify(data),
  });
}

/**
 * Delete an extra.
 * @param id - Extra id
 */
export async function deleteExtra(id: number) {
  // Return the resulting value to the caller.
  return api(`/api/admin/pricing/extras/${id}`, { method: 'DELETE' });
}

/**
 * Server-side quote preview so admins can verify rule changes without
 * creating an order.
 *
 * @param body - Quote inputs mirroring checkout (car, dates, locations, flags)
 */
export async function previewPricing(body: {
  // Provide the car id field value.
  carId: number;
  // Provide the pickup date field value.
  pickupDate: string;
  // Provide the return date field value.
  returnDate: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  returnTime?: string;
  // Provide the pickup location field value.
  pickupLocation: string;
  // Provide the return location field value.
  returnLocation: string;
  // Contribute this line to the enclosing declaration or statement.
  extras?: string[];
  // Contribute this line to the enclosing declaration or statement.
  hotelDelivery?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  lateReturn?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  fuelFee?: boolean;
// Continue the surrounding logic with this statement.
}) {
  // Return the resulting value to the caller.
  return api<{
    // Provide the car field value.
    car: { id: number; name: string };
    // Provide the pricing field value.
    pricing: {
      // Provide the lines field value.
      lines: PriceLine[];
      // Provide the total price field value.
      totalPrice: number;
      // Provide the deposit field value.
      deposit: number;
      // Provide the rental days field value.
      rentalDays: number;
      // Provide the day price field value.
      dayPrice: number;
      // Provide the price breakdown field value.
      priceBreakdown: PriceBreakdown;
    };
  // Continue the surrounding logic with this statement.
  }>('/api/admin/pricing/preview', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}
