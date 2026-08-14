import type {
  Car,
  CarFilters,
  LocationId,
  Pagination,
  SearchCar,
  SearchParams,
} from '../types/api';
import { api } from './client';

export interface GetCarsData {
  cars: Car[];
  pagination: Pagination;
  pickupDateISO: string;
  returnDateISO: string;
  categoryId: number | null;
  filters: CarFilters;
}

export interface SearchCarsData {
  cars: SearchCar[];
  pagination: Pagination;
  search: {
    pickupLocation: LocationId;
    returnLocation: LocationId;
    pickupDate: string;
    returnDate: string;
    pickupTime: string;
    returnTime: string;
  };
  rentalDays: number;
  deliveryPrice: number;
  returnPrice: number;
  filters: CarFilters;
  categoryId: number | null;
}

export interface CarListFilters {
  page?: number;
  categoryId?: number;
  transmission?: string;
  fuelType?: string;
  seatsMin?: string;
  seatsMax?: string;
  priceMin?: string;
  priceMax?: string;
}

function buildFilterParams(filters: CarListFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.categoryId) params.set('categoryId', String(filters.categoryId));
  if (filters.transmission) params.set('transmission', filters.transmission);
  if (filters.fuelType) params.set('fuelType', filters.fuelType);
  if (filters.seatsMin) params.set('seatsMin', filters.seatsMin);
  if (filters.seatsMax) params.set('seatsMax', filters.seatsMax);
  if (filters.priceMin) params.set('priceMin', filters.priceMin);
  if (filters.priceMax) params.set('priceMax', filters.priceMax);
  return params;
}

export function buildSearchQuery(search: SearchParams, filters: CarListFilters = {}): URLSearchParams {
  const params = buildFilterParams(filters);
  params.set('pickup-date', search.pickupDate);
  params.set('return-date', search.returnDate);
  params.set('pickup-time', search.pickupTime);
  params.set('return-time', search.returnTime);
  params.set('pickup-location', search.pickupLocation);
  params.set('return-location', search.returnLocation);
  return params;
}

export async function getCars(filters: CarListFilters = {}): Promise<GetCarsData> {
  const params = buildFilterParams(filters);
  const qs = params.toString();
  return api<GetCarsData>(`/api/cars${qs ? `?${qs}` : ''}`);
}

export async function searchCars(
  search: SearchParams,
  filters: CarListFilters = {},
): Promise<SearchCarsData> {
  const params = buildSearchQuery(search, filters);
  return api<SearchCarsData>(`/api/cars/search?${params.toString()}`);
}

export async function getCar(carId: string): Promise<{ car: Car }> {
  return api<{ car: Car }>(`/api/cars/${carId}`);
}
