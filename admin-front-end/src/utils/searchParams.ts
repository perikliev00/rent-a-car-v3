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
  // Evaluate the condition and enter the branch when it is true.
  if (!value) return null;
  // Create the input constant.
  const input = value.trim();
  // Evaluate the condition and enter the branch when it is true.
  if (!input) return null;
  // Already canonical.
  if (/^\d{2}:\d{2}$/.test(input)) return input;
  // Create the match constant.
  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  // Evaluate the condition and enter the branch when it is true.
  if (!match) return null;
  // Create the hour constant.
  const hour = Number(match[1]);
  // Create the minute constant.
  const minute = Number(match[2]);
  // Reject non-integer or out-of-range clock values.
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  // Return the resulting value to the caller.
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Split a comma-separated extras query value into trimmed codes.
 * @param value - `extras` query param or null
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
 * Prefer full over basic when both insurance packages are selected.
 * @param extras - Extra codes from UI or URL
 */
export function normalizeClientExtras(extras: string[]): string[] {
  // Create the unique constant.
  const unique = [...new Set(extras.filter(Boolean))];
  // Create the has full constant.
  const hasFull = unique.includes('insurance_full');
  // Create the has basic constant.
  const hasBasic = unique.includes('insurance_basic');
  // Mutual exclusion: keep full, drop basic.
  if (hasFull && hasBasic) {
    // Return the resulting value to the caller.
    return unique.filter((code) => code !== 'insurance_basic');
  }
  // Return the resulting value to the caller.
  return unique;
}

/**
 * Serialize {@link SearchParams} into kebab-case query keys used by booking URLs.
 * @param search - Structured search state
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

  // Create the extras constant.
  const extras = normalizeClientExtras(search.extras || []);
  // Evaluate the condition and enter the branch when it is true.
  if (extras.length) {
    // Update query.extras with the right-hand side value.
    query.extras = extras.join(',');
  }
  // Flag encoded as `1` when hotel delivery is requested.
  if (search.hotelDelivery) {
    // Update query.hotelDelivery with the right-hand side value.
    query.hotelDelivery = '1';
  }

  // Return the resulting value to the caller.
  return query;
}

/**
 * Parse booking search state from URLSearchParams; null if required fields missing.
 * @param params - Current URL search params
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

  // Create the pickup time constant.
  const pickupTime = toHHMM(pickupTimeRaw);
  // Create the return time constant.
  const returnTime = toHHMM(returnTimeRaw);

  // All core booking fields must be present and valid.
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
 * Default booking search: today→tomorrow, 10:00, office locations, no extras.
 */
export function defaultSearchParams(): SearchParams {
  // Create the today constant.
  const today = new Date();
  // Create the tomorrow constant.
  const tomorrow = new Date(today);
  // Call tomorrow.setDate to perform this step.
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
 * Build a query string for booking navigation from structured search state.
 * @param search - Structured search state
 */
export function bookingQueryString(search: SearchParams): string {
  // Return the resulting value to the caller.
  return new URLSearchParams(searchParamsToQuery(search)).toString();
}
