/**
 * The only function tool available to the browser voice model.
 * Strictly read-only and backed by the same validated fleet search as the SPA.
 */
import { searchCars } from '../../api/cars';
import type { LocationId, SearchParams } from '../../types/api';
import { searchParamsToQuery } from '../../utils/searchParams';

const LOCATIONS: LocationId[] = [
  'office', 'sunny-beach', 'sveti-vlas', 'nesebar', 'burgas', 'burgas-airport',
  'sofia', 'sofia-airport', 'varna', 'varna-airport', 'plovdiv', 'eleni', 'ravda',
];

function isLocation(value: unknown): value is LocationId {
  return typeof value === 'string' && LOCATIONS.includes(value as LocationId);
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return !!match && Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

export function validateVoiceSearch(input: unknown): { search: SearchParams; transmission?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Missing search parameters.');
  }
  const data = input as Record<string, unknown>;
  if (!isDate(data.pickupDate) || !isDate(data.returnDate) ||
      !isTime(data.pickupTime) || !isTime(data.returnTime) ||
      !isLocation(data.pickupLocation) || !isLocation(data.returnLocation)) {
    throw new Error('Please specify valid dates, local times and pickup/return locations.');
  }
  if (data.transmission !== undefined && data.transmission !== 'Automatic' &&
      data.transmission !== 'Manual') {
    throw new Error('Invalid transmission.');
  }
  if (data.pickupDate > data.returnDate ||
      (data.pickupDate === data.returnDate && data.pickupTime >= data.returnTime)) {
    throw new Error('Return must be after pickup.');
  }
  return {
    search: {
      pickupDate: data.pickupDate,
      returnDate: data.returnDate,
      pickupTime: data.pickupTime,
      returnTime: data.returnTime,
      pickupLocation: data.pickupLocation,
      returnLocation: data.returnLocation,
      extras: [],
      hotelDelivery: false,
    },
    transmission: data.transmission as string | undefined,
  };
}

export async function runVoiceCarSearch(args: unknown): Promise<{ output: string; link: string | null }> {
  const { search, transmission } = validateVoiceSearch(args);
  const result = await searchCars(search, transmission ? { transmission } : {});
  const url = '/search?' + new URLSearchParams(searchParamsToQuery(search)).toString() +
    (transmission ? '&transmission=' + encodeURIComponent(transmission) : '');
  // Only public, trip-relevant fields are returned to the model; no PII or full DB rows.
  const cars = result.cars.slice(0, 5).map((car) => ({
    id: car.id,
    name: car.name,
    transmission: car.transmission,
    seats: car.seats,
    rentalDays: car.rentalDays,
    totalPrice: car.totalPrice,
    currency: 'EUR',
  }));
  return {
    output: JSON.stringify({
      cars,
      countOnThisPage: result.cars.length,
      hasMorePages: result.pagination.totalPages > 1,
      bookingIsNotConfirmed: true,
      message: 'Customer can see live search results and start normal booking in the web interface.',
    }),
    link: url,
  };
}
