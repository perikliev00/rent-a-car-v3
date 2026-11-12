/**
 * Booking search param serialize/parse helpers shared with order forms.
 */
import type { LocationId, SearchParams } from '../types/api';

/**
 * Normalize a time string to `HH:MM`, or null if invalid/empty.
 * Accepts already-padded `HH:MM` or shorter hour forms like `9:30`.
 *
 * @param value - Raw time from the URL or form
 */
function toHHMM(value: string | null): string | null {
  if (!value) return null;
  const input = value.trim();
  if (!input) return null;
  // Already canonical.
  if (/^\d{2}:\d{2}$/.test(input)) return input;
  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  // Reject non-integer or out-of-range clock values.
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Split a comma-separated extras query value into trimmed codes.
 * @param value - `extras` query param or null
 */
export function parseExtrasFromQuery(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Prefer full over basic when both insurance packages are selected.
 * @param extras - Extra codes from UI or URL
 */
export function normalizeClientExtras(extras: string[]): string[] {
  const unique = [...new Set(extras.filter(Boolean))];
  const hasFull = unique.includes('insurance_full');
  const hasBasic = unique.includes('insurance_basic');
  // Mutual exclusion: keep full, drop basic.
  if (hasFull && hasBasic) {
    return unique.filter((code) => code !== 'insurance_basic');
  }
  return unique;
}

/**
 * Serialize {@link SearchParams} into kebab-case query keys used by booking URLs.
 * @param search - Structured search state
 */
export function searchParamsToQuery(search: SearchParams): Record<string, string> {
  const query: Record<string, string> = {
    'pickup-date': search.pickupDate,
    'return-date': search.returnDate,
    'pickup-time': search.pickupTime,
    'return-time': search.returnTime,
    'pickup-location': search.pickupLocation,
    'return-location': search.returnLocation,
  };

  const extras = normalizeClientExtras(search.extras || []);
  if (extras.length) {
    query.extras = extras.join(',');
  }
  // Flag encoded as `1` when hotel delivery is requested.
  if (search.hotelDelivery) {
    query.hotelDelivery = '1';
  }

  return query;
}

/**
 * Parse booking search state from URLSearchParams; null if required fields missing.
 * @param params - Current URL search params
 */
export function parseSearchFromUrl(params: URLSearchParams): SearchParams | null {
  const pickupDate = params.get('pickup-date');
  const returnDate = params.get('return-date');
  const pickupTimeRaw = params.get('pickup-time');
  const returnTimeRaw = params.get('return-time');
  const pickupLocation = params.get('pickup-location') as LocationId | null;
  const returnLocation = params.get('return-location') as LocationId | null;

  const pickupTime = toHHMM(pickupTimeRaw);
  const returnTime = toHHMM(returnTimeRaw);

  // All core booking fields must be present and valid.
  if (!pickupDate || !returnDate || !pickupTime || !returnTime || !pickupLocation || !returnLocation) {
    return null;
  }

  return {
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    extras: normalizeClientExtras(parseExtrasFromQuery(params.get('extras'))),
    hotelDelivery: params.get('hotelDelivery') === '1',
  };
}

/**
 * Default booking search: today→tomorrow, 10:00, office locations, no extras.
 */
export function defaultSearchParams(): SearchParams {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    pickupDate: today.toISOString().split('T')[0],
    returnDate: tomorrow.toISOString().split('T')[0],
    pickupTime: '10:00',
    returnTime: '10:00',
    pickupLocation: 'office',
    returnLocation: 'office',
    extras: [],
    hotelDelivery: false,
  };
}

/**
 * Build a query string for booking navigation from structured search state.
 * @param search - Structured search state
 */
export function bookingQueryString(search: SearchParams): string {
  return new URLSearchParams(searchParamsToQuery(search)).toString();
}
