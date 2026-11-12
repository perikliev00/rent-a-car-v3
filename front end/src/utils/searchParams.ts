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
  // Create the input constant.
  const input = value.trim();
  // Whitespace-only is treated as missing.
  if (!input) return null;
  // Already canonical `HH:MM`.
  if (/^\d{2}:\d{2}$/.test(input)) return input;
  // Allow single-digit hours (e.g. `9:30`) and pad below.
  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  // Evaluate the condition and enter the branch when it is true.
  if (!match) return null;
  // Create the hour constant.
  const hour = Number(match[1]);
  // Create the minute constant.
  const minute = Number(match[2]);
  // Reject non-integers and out-of-range clock values.
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  // Return the resulting value to the caller.
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Parse a comma-separated extras list from the URL.
 *
 * @param value - Raw `extras` query value, or `null` when absent.
 * @returns Trimmed non-empty extra codes (may still contain duplicates until normalized).
 */
export function parseExtrasFromQuery(value: string | null): string[] {
  // Evaluate the condition and enter the branch when it is true.
  if (!value) return [];
  // Return the resulting value to the caller.
  return value
    // Call .split to perform this step.
    .split(',')
    // Call .map to perform this step.
    .map((s) => s.trim())
    // Call .filter to perform this step.
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
  // Create the has full constant.
  const hasFull = unique.includes('insurance_full');
  // Create the has basic constant.
  const hasBasic = unique.includes('insurance_basic');
  // Full coverage supersedes basic — keep only the higher tier.
  if (hasFull && hasBasic) {
    // Return the resulting value to the caller.
    return unique.filter((code) => code !== 'insurance_basic');
  }
  // Return the resulting value to the caller.
  return unique;
}

/**
 * Serialize trip criteria into a plain query-object for navigation.
 *
 * @param search - Complete pickup/return criteria plus optional extras/hotel delivery.
 * @returns Record of kebab-case query keys; omits empty extras and unset hotel delivery.
 */
export function searchParamsToQuery(search: SearchParams): Record<string, string> {
  // Continue the surrounding logic with this statement.
  const query: Record<string, string> = {
    // Supply the literal value used by the enclosing expression.
    'pickup-date': search.pickupDate,
    // Supply the literal value used by the enclosing expression.
    'return-date': search.returnDate,
    // Supply the literal value used by the enclosing expression.
    'pickup-time': search.pickupTime,
    // Supply the literal value used by the enclosing expression.
    'return-time': search.returnTime,
    // Supply the literal value used by the enclosing expression.
    'pickup-location': search.pickupLocation,
    // Supply the literal value used by the enclosing expression.
    'return-location': search.returnLocation,
  };

  // Normalize before serializing so conflicting insurance codes never hit the URL.
  const extras = normalizeClientExtras(search.extras || []);
  // Evaluate the condition and enter the branch when it is true.
  if (extras.length) {
    // Update query.extras with the right-hand side value.
    query.extras = extras.join(',');
  }
  // Use a compact flag rather than a boolean string.
  if (search.hotelDelivery) {
    // Update query.hotelDelivery with the right-hand side value.
    query.hotelDelivery = '1';
  }

  // Return the resulting value to the caller.
  return query;
}

/**
 * Parse booking search criteria from the current URL.
 *
 * @param params - `URLSearchParams` from the router or `window.location`.
 * @returns A complete {@link SearchParams} object, or `null` if any required field is missing/invalid.
 */
export function parseSearchFromUrl(params: URLSearchParams): SearchParams | null {
  // Create the pickup date constant.
  const pickupDate = params.get('pickup-date');
  // Create the return date constant.
  const returnDate = params.get('return-date');
  // Create the pickup time raw constant.
  const pickupTimeRaw = params.get('pickup-time');
  // Create the return time raw constant.
  const returnTimeRaw = params.get('return-time');
  // Create the pickup location constant.
  const pickupLocation = params.get('pickup-location') as LocationId | null;
  // Create the return location constant.
  const returnLocation = params.get('return-location') as LocationId | null;

  // Normalize times so `9:05` and `09:05` both validate.
  const pickupTime = toHHMM(pickupTimeRaw);
  // Create the return time constant.
  const returnTime = toHHMM(returnTimeRaw);

  // Incomplete deep-links should not invent defaults here — callers decide fallbacks.
  if (!pickupDate || !returnDate || !pickupTime || !returnTime || !pickupLocation || !returnLocation) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    pickupDate,
    // Contribute this line to the enclosing declaration or statement.
    returnDate,
    // Contribute this line to the enclosing declaration or statement.
    pickupTime,
    // Contribute this line to the enclosing declaration or statement.
    returnTime,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    // Provide the extras field value.
    extras: normalizeClientExtras(parseExtrasFromQuery(params.get('extras'))),
    // Provide the hotel delivery field value.
    hotelDelivery: params.get('hotelDelivery') === '1',
  };
}

/**
 * Default trip window when the URL has no usable search criteria.
 *
 * @returns Pickup today / return tomorrow at 10:00, both at the office, with no extras.
 */
export function defaultSearchParams(): SearchParams {
  // Create the today constant.
  const today = new Date();
  // Create the tomorrow constant.
  const tomorrow = new Date(today);
  // Advance one local calendar day for a minimal overnight rental default.
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Return the resulting value to the caller.
  return {
    // Provide the pickup date field value.
    pickupDate: today.toISOString().split('T')[0],
    // Provide the return date field value.
    returnDate: tomorrow.toISOString().split('T')[0],
    // Provide the pickup time field value.
    pickupTime: '10:00',
    // Provide the return time field value.
    returnTime: '10:00',
    // Provide the pickup location field value.
    pickupLocation: 'office',
    // Provide the return location field value.
    returnLocation: 'office',
    // Provide the extras field value.
    extras: [],
    // Provide the hotel delivery field value.
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
  // Return the resulting value to the caller.
  return new URLSearchParams(searchParamsToQuery(search)).toString();
}
