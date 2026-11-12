/**
 * Location catalog, delivery/return fees, pricing-info metadata, and categories.
 * Used by the search form and price-explanation UI.
 */
import type { DeliveryFees, LocationOption } from '../types/api';
import { api } from './client';

/** Pickup/return locations plus per-location delivery and return fee maps. */
export interface LocationsData {
  locations: LocationOption[];
  deliveryFees: DeliveryFees;
  returnFees: DeliveryFees;
}

/**
 * Static pricing copy and fee tables shown before a concrete search
 * (tier explanations, extras catalog, deposit, global fees).
 */
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

/** Fleet category used for search filters. */
export interface Category {
  id: number;
  name: string;
}

/**
 * Load bookable locations and their delivery/return fee maps.
 *
 * @returns Locations list plus fee maps keyed by location id.
 */
export async function getLocations(): Promise<LocationsData> {
  return api<LocationsData>('/api/locations');
}

/**
 * Load pricing explanations and fee/extras catalogs for marketing/search UI.
 *
 * @returns Tier copy, extras, deposit, and global fee metadata.
 */
export async function getPricingInfo(): Promise<PricingInfoData> {
  return api<PricingInfoData>('/api/pricing-info');
}

/**
 * Load car categories for fleet filters.
 *
 * @returns Category id/name pairs for filter dropdowns.
 */
export async function getCategories(): Promise<{ categories: Category[] }> {
  return api<{ categories: Category[] }>('/api/categories');
}
