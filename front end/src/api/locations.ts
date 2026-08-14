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

export async function getLocations(): Promise<LocationsData> {
  return api<LocationsData>('/api/locations');
}

export async function getPricingInfo(): Promise<PricingInfoData> {
  return api<PricingInfoData>('/api/pricing-info');
}

export async function getCategories(): Promise<{ categories: Category[] }> {
  return api<{ categories: Category[] }>('/api/categories');
}
