/**
 * Public catalog endpoints used by admin order/pricing UIs
 * (locations, delivery fees, categories, pricing info copy).
 */
import type { DeliveryFees, LocationOption } from '../types/api';
// Import named exports from './client'.
import { api } from './client';

// Export the locations data interface.
export interface LocationsData {
  // Provide the locations field value.
  locations: LocationOption[];
  // Provide the delivery fees field value.
  deliveryFees: DeliveryFees;
  // Provide the return fees field value.
  returnFees: DeliveryFees;
}

// Export the pricing info data interface.
export interface PricingInfoData {
  // Provide the delivery fees field value.
  deliveryFees: DeliveryFees;
  // Provide the return fees field value.
  returnFees: DeliveryFees;
  // Continue the surrounding logic with this statement.
  extras?: Array<{
    // Provide the code field value.
    code: string;
    // Provide the label field value.
    label: string;
    // Provide the mode field value.
    mode: string;
    // Provide the amount field value.
    amount: number;
  // Continue the surrounding logic with this statement.
  }>;
  // Contribute this line to the enclosing declaration or statement.
  deposit?: number;
  // Continue the surrounding logic with this statement.
  globalFees?: Array<{
    // Provide the fee key field value.
    feeKey: string;
    // Provide the label field value.
    label: string;
    // Provide the amount field value.
    amount: number;
    // Provide the mode field value.
    mode: string;
  // Continue the surrounding logic with this statement.
  }>;
  // Provide the price tier explanation field value.
  priceTierExplanation: {
    // Provide the tier1 3 field value.
    tier1_3: string;
    // Provide the tier7 31 field value.
    tier7_31: string;
    // Provide the tier31 plus field value.
    tier31_plus: string;
  };
}

// Export the category interface.
export interface Category {
  // Provide the id field value.
  id: number;
  // Provide the name field value.
  name: string;
}

/**
 * Pickup/return locations plus delivery and return fee maps.
 */
export async function getLocations(): Promise<LocationsData> {
  // Return the resulting value to the caller.
  return api<LocationsData>('/api/locations');
}

/**
 * Public pricing-info payload (fees, extras, deposit, tier explanation copy).
 */
export async function getPricingInfo(): Promise<PricingInfoData> {
  // Return the resulting value to the caller.
  return api<PricingInfoData>('/api/pricing-info');
}

/**
 * Vehicle category list for filters and car forms.
 */
export async function getCategories(): Promise<{ categories: Category[] }> {
  // Return the resulting value to the caller.
  return api<{ categories: Category[] }>('/api/categories');
}
