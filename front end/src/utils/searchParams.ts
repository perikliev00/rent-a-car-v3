/**
 * Helpers for reading/writing booking search criteria in the URL query string.
 * Keeps the public search, results, and order flows aligned on the same kebab-case keys.
 */
import type { LocationId, SearchParams } from '../types/api';

/**
 * Normalize a time string to `HH:MM` (24-hour).
 *
 * @param value - Raw query value, possibly missing or loosely formatted (`9:30`).
 * @returns Zero-padded `HH:MM`, or `null` when the value is empty or invalid.
 */
function toHHMM(value: string | null): string | null {
  // Absent query param.
  if (!value) return null;
  const input = value.trim();
  // Whitespace-only is treated as missing.
  if (!input) return null;
  // Already canonical `HH:MM`.
  if (/^\d{2}:\d{2}$/.test(input)) return input;
  // Allow single-digit hours (e.g. `9:30`) and pad below.
  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  // Reject non-integers and out-of-range clock values.
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Parse a comma-separated extras list from the URL.
 *
 * @param value - Raw `extras` query value, or `null` when absent.
 * @returns Trimmed non-empty extra codes (may still contain duplicates until normalized).
 */
export function parseExtrasFromQuery(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Deduplicate extras and resolve insurance package conflicts.
 *
 * @param extras - Selected extra codes from the URL or form state.
 * @returns Unique codes; drops `insurance_basic` when `insurance_full` is also present.
 * @remarks Prefer full over basic when both insurance packages are selected.
 */
export function normalizeClientExtras(extras: string[]): string[] {
  // Drop empties and collapse duplicates via Set.
  const unique = [...new Set(extras.filter(Boolean))];
  const hasFull = unique.includes('insurance_full');
  const hasBasic = unique.includes('insurance_basic');
  // Full coverage supersedes basic — keep only the higher tier.
  if (hasFull && hasBasic) {
    return unique.filter((code) => code !== 'insurance_basic');
  }
  return unique;
}

/**
 * Serialize trip criteria into a plain query-object for navigation.
 *
 * @param search - Complete pickup/return criteria plus optional extras/hotel delivery.
 * @returns Record of kebab-case query keys; omits empty extras and unset hotel delivery.
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

  // Normalize before serializing so conflicting insurance codes never hit the URL.
  const extras = normalizeClientExtras(search.extras || []);
  if (extras.length) {
    query.extras = extras.join(',');
  }
  // Use a compact flag rather than a boolean string.
  if (search.hotelDelivery) {
    query.hotelDelivery = '1';
  }

  return query;
}

/**
 * Parse booking search criteria from the current URL.
 *
 * @param params - `URLSearchParams` from the router or `window.location`.
 * @returns A complete {@link SearchParams} object, or `null` if any required field is missing/invalid.
 */
export function parseSearchFromUrl(params: URLSearchParams): SearchParams | null {
  const pickupDate = params.get('pickup-date');
  const returnDate = params.get('return-date');
  const pickupTimeRaw = params.get('pickup-time');
  const returnTimeRaw = params.get('return-time');
  const pickupLocation = params.get('pickup-location') as LocationId | null;
  const returnLocation = params.get('return-location') as LocationId | null;

  // Normalize times so `9:05` and `09:05` both validate.
  const pickupTime = toHHMM(pickupTimeRaw);
  const returnTime = toHHMM(returnTimeRaw);

  // Incomplete deep-links should not invent defaults here — callers decide fallbacks.
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
 * Default trip window when the URL has no usable search criteria.
 *
 * @returns Pickup today / return tomorrow at 10:00, both at the office, with no extras.
 */
export function defaultSearchParams(): SearchParams {
  const today = new Date();
  const tomorrow = new Date(today);
  // Advance one local calendar day for a minimal overnight rental default.
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
 * Build a query string for booking navigation from trip criteria.
 *
 * @param search - Complete search params including optional extras/hotel delivery.
 * @returns Encoded query string (no leading `?`).
 */
export function bookingQueryString(search: SearchParams): string {
  return new URLSearchParams(searchParamsToQuery(search)).toString();
}
