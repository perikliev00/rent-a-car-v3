/**
 * Display helpers for car images, EUR prices, and ISO date arithmetic used by search defaults.
 */
import { API_BASE } from '../api/client';

/**
 * Resolve a car image path for `<img src>`.
 *
 * @param path - Absolute URL, API-relative `/images/...` path, or empty/missing value.
 * @returns A browser-ready URL, or the local placeholder SVG when `path` is absent.
 * @remarks Absolute http(s) URLs pass through unchanged; `/images/...` is prefixed with {@link API_BASE}.
 */
export function imageUrl(path: string | undefined | null): string {
  // Missing or empty path: show the fleet placeholder.
  if (!path) return '/placeholder-car.svg';
  // Already a full URL (CDN or external host).
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // Backend-served fleet assets live under /images on the API origin.
  if (path.startsWith('/images/')) return `${API_BASE}${path}`;
  // Relative path the bundler or host can resolve as-is.
  return path;
}

/**
 * Format a numeric or string amount as EUR using the en-EU locale.
 *
 * @param amount - Numeric value or parseable numeric string from the API.
 * @returns Localized currency string (e.g. `€12.50`).
 */
export function formatPrice(amount: number | string): string {
  // Coerce string amounts from JSON/API payloads to a number first.
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(num);
}

/**
 * Today's calendar date as `YYYY-MM-DD`.
 *
 * @returns UTC date portion of the current ISO timestamp.
 */
export function todayISO(): string {
  // Split on `T` so callers get a date-only string for `<input type="date">` and search params.
  return new Date().toISOString().split('T')[0];
}

/**
 * Tomorrow's calendar date as `YYYY-MM-DD`.
 *
 * @returns Date one calendar day after today, as an ISO date string.
 */
export function tomorrowISO(): string {
  const d = new Date();
  // Advance by one local calendar day before formatting.
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Add calendar days to an ISO date string.
 *
 * @param dateStr - Base date in `YYYY-MM-DD` form.
 * @param days - Number of calendar days to add (may be negative).
 * @returns Resulting date as `YYYY-MM-DD`.
 * @remarks Noon local time avoids DST edge cases when shifting across midnight.
 */
export function addDaysISO(dateStr: string, days: number): string {
  // Anchor at noon so DST transitions do not push the calendar day backward/forward.
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
