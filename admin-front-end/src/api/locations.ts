/**
 * Public catalog endpoints used by admin order/pricing UIs
 * (locations, delivery fees, categories, pricing info copy).
 */
import type { DeliveryFees, LocationOption } from '../types/api';
import { api } from './client';

export interface LocationsData {
  locations: LocationOption[];
  deliveryFees: DeliveryFees;
  returnFees: DeliveryFees;
}

export interface PricingInfoData {
  deliveryFees: DeliveryFees;
  returnFees: DeliveryFees;
  extras?: Array<{
    code: string;
    label: string;
    mode: string;
    amount: number;
  }>;
  deposit?: number;
  globalFees?: Array<{
    feeKey: string;
    label: string;
    amount: number;
    mode: string;
  }>;
  priceTierExplanation: {
    tier1_3: string;
    tier7_31: string;
    tier31_plus: string;
  };
}

export interface Category {
  id: number;
  name: string;
}

/**
 * Pickup/return locations plus delivery and return fee maps.
 */
export async function getLocations(): Promise<LocationsData> {
  return api<LocationsData>('/api/locations');
}

/**
 * Public pricing-info payload (fees, extras, deposit, tier explanation copy).
 */
export async function getPricingInfo(): Promise<PricingInfoData> {
  return api<PricingInfoData>('/api/pricing-info');
}

/**
 * Vehicle category list for filters and car forms.
 */
export async function getCategories(): Promise<{ categories: Category[] }> {
  return api<{ categories: Category[] }>('/api/categories');
}
