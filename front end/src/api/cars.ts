/**
 * Fleet and availability search endpoints.
 * {@link getCars} lists the catalog; {@link searchCars} prices cars for a trip
 * window and locations. Query keys use kebab-case to match the public booking URL.
 */
import type {
  // Contribute this line to the enclosing declaration or statement.
  Car,
  // Contribute this line to the enclosing declaration or statement.
  CarFilters,
  // Contribute this line to the enclosing declaration or statement.
  LocationId,
  // Contribute this line to the enclosing declaration or statement.
  Pagination,
  // Contribute this line to the enclosing declaration or statement.
  SearchCar,
  // Contribute this line to the enclosing declaration or statement.
  SearchParams,
// Contribute this line to the enclosing declaration or statement.
} from '../types/api';
// Import named exports from './client'.
import { api } from './client';

/** Response from the unfiltered / lightly filtered fleet list. */
export interface GetCarsData {
  // Provide the cars field value.
  cars: Car[];
  // Provide the pagination field value.
  pagination: Pagination;
  // Provide the pickup date iso field value.
  pickupDateISO: string;
  // Provide the return date iso field value.
  returnDateISO: string;
  // Provide the category id field value.
  categoryId: number | null;
  // Provide the filters field value.
  filters: CarFilters;
}

/** Response from availability search, including trip-scoped pricing. */
export interface SearchCarsData {
  // Provide the cars field value.
  cars: SearchCar[];
  // Provide the pagination field value.
  pagination: Pagination;
  // Provide the search field value.
  search: {
    // Provide the pickup location field value.
    pickupLocation: LocationId;
    // Provide the return location field value.
    returnLocation: LocationId;
    // Provide the pickup date field value.
    pickupDate: string;
    // Provide the return date field value.
    returnDate: string;
    // Provide the pickup time field value.
    pickupTime: string;
    // Provide the return time field value.
    returnTime: string;
  };
  // Provide the rental days field value.
  rentalDays: number;
  // Provide the delivery price field value.
  deliveryPrice: number;
  // Provide the return price field value.
  returnPrice: number;
  // Provide the filters field value.
  filters: CarFilters;
  // Provide the category id field value.
  categoryId: number | null;
}

/** Optional facet filters shared by list and search queries. */
export interface CarListFilters {
  // Contribute this line to the enclosing declaration or statement.
  page?: number;
  // Contribute this line to the enclosing declaration or statement.
  categoryId?: number;
  // Contribute this line to the enclosing declaration or statement.
  transmission?: string;
  // Contribute this line to the enclosing declaration or statement.
  fuelType?: string;
  // Contribute this line to the enclosing declaration or statement.
  seatsMin?: string;
  // Contribute this line to the enclosing declaration or statement.
  seatsMax?: string;
  // Contribute this line to the enclosing declaration or statement.
  priceMin?: string;
  // Contribute this line to the enclosing declaration or statement.
  priceMax?: string;
}

/**
 * Build query params for category/transmission/fuel/seats/price facets.
 *
 * @param filters - Optional facet values from the fleet filter UI.
 * @returns URLSearchParams containing only the filters that were provided.
 */
function buildFilterParams(filters: CarListFilters): URLSearchParams {
  // Create the params constant.
  const params = new URLSearchParams();
  // Only set defined facets so the API applies its own defaults for omitted keys.
  if (filters.page) params.set('page', String(filters.page));
  // Evaluate the condition and enter the branch when it is true.
  if (filters.categoryId) params.set('categoryId', String(filters.categoryId));
  // Evaluate the condition and enter the branch when it is true.
  if (filters.transmission) params.set('transmission', filters.transmission);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.fuelType) params.set('fuelType', filters.fuelType);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.seatsMin) params.set('seatsMin', filters.seatsMin);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.seatsMax) params.set('seatsMax', filters.seatsMax);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.priceMin) params.set('priceMin', filters.priceMin);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.priceMax) params.set('priceMax', filters.priceMax);
  // Return the resulting value to the caller.
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
  // Create the params constant.
  const params = buildFilterParams(filters);
  // Trip criteria always override / extend the facet params.
  params.set('pickup-date', search.pickupDate);
  // Call params.set to perform this step.
  params.set('return-date', search.returnDate);
  // Call params.set to perform this step.
  params.set('pickup-time', search.pickupTime);
  // Call params.set to perform this step.
  params.set('return-time', search.returnTime);
  // Call params.set to perform this step.
  params.set('pickup-location', search.pickupLocation);
  // Call params.set to perform this step.
  params.set('return-location', search.returnLocation);
  // Return the resulting value to the caller.
  return params;
}

/**
 * List cars with optional facet filters (no trip pricing).
 *
 * @param filters - Optional pagination and facet filters.
 * @returns Fleet list plus pagination and filter metadata.
 */
export async function getCars(filters: CarListFilters = {}): Promise<GetCarsData> {
  // Create the params constant.
  const params = buildFilterParams(filters);
  // Create the qs constant.
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
  // Provide the search field value.
  search: SearchParams,
  // Provide the filters field value.
  filters: CarListFilters = {},
// Continue the surrounding logic with this statement.
): Promise<SearchCarsData> {
  // Create the params constant.
  const params = buildSearchQuery(search, filters);
  // Return the resulting value to the caller.
  return api<SearchCarsData>(`/api/cars/search?${params.toString()}`);
}

/**
 * Fetch a single car by id for the detail page.
 *
 * @param carId - Fleet car identifier.
 * @returns Wrapper containing the car record.
 */
export async function getCar(carId: string): Promise<{ car: Car }> {
  // Return the resulting value to the caller.
  return api<{ car: Car }>(`/api/cars/${carId}`);
}
