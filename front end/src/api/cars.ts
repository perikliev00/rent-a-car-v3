/**
 * Fleet and availability search endpoints.
 * {@link getCars} lists the catalog; {@link searchCars} prices cars for a trip
 * window and locations. Query keys use kebab-case to match the public booking URL.
 */
import type {
  Car,
  CarFilters,
  LocationId,
  Pagination,
  SearchCar,
  SearchParams,
} from '../types/api';
import { api } from './client';

/** Response from the unfiltered / lightly filtered fleet list. */
export interface GetCarsData {
  cars: Car[];
  pagination: Pagination;
  pickupDateISO: string;
  returnDateISO: string;
  categoryId: number | null;
  filters: CarFilters;
}

/** Response from availability search, including trip-scoped pricing. */
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

/** Optional facet filters shared by list and search queries. */
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

/**
 * Build query params for category/transmission/fuel/seats/price facets.
 *
 * @param filters - Optional facet values from the fleet filter UI.
 * @returns URLSearchParams containing only the filters that were provided.
 */
function buildFilterParams(filters: CarListFilters): URLSearchParams {
  const params = new URLSearchParams();
  // Only set defined facets so the API applies its own defaults for omitted keys.
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

/**
 * Serialize trip criteria + optional filters for `/api/cars/search`.
 *
 * @param search - Pickup/return date, time, and location criteria.
 * @param filters - Optional facet filters layered on top of the trip window.
 * @returns Query params ready to append to the search endpoint.
 * @remarks Date/location keys use kebab-case to stay aligned with the public search URL.
 */
export function buildSearchQuery(search: SearchParams, filters: CarListFilters = {}): URLSearchParams {
  const params = buildFilterParams(filters);
  // Trip criteria always override / extend the facet params.
  params.set('pickup-date', search.pickupDate);
  params.set('return-date', search.returnDate);
  params.set('pickup-time', search.pickupTime);
  params.set('return-time', search.returnTime);
  params.set('pickup-location', search.pickupLocation);
  params.set('return-location', search.returnLocation);
  return params;
}

/**
 * List cars with optional facet filters (no trip pricing).
 *
 * @param filters - Optional pagination and facet filters.
 * @returns Fleet list plus pagination and filter metadata.
 */
export async function getCars(filters: CarListFilters = {}): Promise<GetCarsData> {
  const params = buildFilterParams(filters);
  const qs = params.toString();
  // Omit the `?` entirely when there are no filters.
  return api<GetCarsData>(`/api/cars${qs ? `?${qs}` : ''}`);
}

/**
 * Search available cars for a trip window and return priced results.
 *
 * @param search - Required trip criteria.
 * @param filters - Optional facet filters applied server-side.
 * @returns Priced search results including delivery/return fees and rental days.
 */
export async function searchCars(
  search: SearchParams,
  filters: CarListFilters = {},
): Promise<SearchCarsData> {
  const params = buildSearchQuery(search, filters);
  return api<SearchCarsData>(`/api/cars/search?${params.toString()}`);
}

/**
 * Fetch a single car by id for the detail page.
 *
 * @param carId - Fleet car identifier.
 * @returns Wrapper containing the car record.
 */
export async function getCar(carId: string): Promise<{ car: Car }> {
  return api<{ car: Car }>(`/api/cars/${carId}`);
}
