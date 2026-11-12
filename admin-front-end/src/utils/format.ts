/**
 * Display helpers for car image URLs, EUR prices, and ISO date arithmetic.
 */
import { API_BASE } from '../api/client';

/**
 * Resolves relative `/images/…` paths against the API host; falls back to placeholder.
 * Absolute http(s) URLs pass through unchanged.
 *
 * @param path - Stored image path or absolute URL
 */
export function imageUrl(path: string | undefined | null): string {
  // Evaluate the condition and enter the branch when it is true.
  if (!path) return '/placeholder-car.svg';
  // Evaluate the condition and enter the branch when it is true.
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // API-hosted fleet images are served from the backend origin.
  if (path.startsWith('/images/')) return `${API_BASE}${path}`;
  // Return the resulting value to the caller.
  return path;
}

/**
 * Format a numeric or numeric-string amount as EUR for admin tables.
 * @param amount - Price value from the API
 */
export function formatPrice(amount: number | string): string {
  // Create the num constant.
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  // Return the resulting value to the caller.
  return new Intl.NumberFormat('en-EU', {
    // Provide the style field value.
    style: 'currency',
    // Provide the currency field value.
    currency: 'EUR',
    // Provide the minimum fraction digits field value.
    minimumFractionDigits: 2,
  // Continue the surrounding logic with this statement.
  }).format(num);
}

/** Today's calendar date as `YYYY-MM-DD` (UTC date from ISO). */
export function todayISO(): string {
  // Return the resulting value to the caller.
  return new Date().toISOString().split('T')[0];
}

/** Tomorrow's calendar date as `YYYY-MM-DD`. */
export function tomorrowISO(): string {
  // Create the d constant.
  const d = new Date();
  // Call d.setDate to perform this step.
  d.setDate(d.getDate() + 1);
  // Return the resulting value to the caller.
  return d.toISOString().split('T')[0];
}

/**
 * Add whole days to an ISO date string.
 * Noon local time avoids DST off-by-one when adding whole days to ISO dates.
 *
 * @param dateStr - `YYYY-MM-DD`
 * @param days - Days to add (may be negative)
 */
export function addDaysISO(dateStr: string, days: number): string {
  // Create the d constant.
  const d = new Date(dateStr + 'T12:00:00');
  // Call d.setDate to perform this step.
  d.setDate(d.getDate() + days);
  // Return the resulting value to the caller.
  return d.toISOString().split('T')[0];
}
