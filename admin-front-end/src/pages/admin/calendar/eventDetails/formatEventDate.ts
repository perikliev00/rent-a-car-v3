/**
 * Local date/time formatting for event detail rows.
 */
import { format, parseISO } from 'date-fns';

/**
 * Format an ISO timestamp for event detail rows; returns raw input on parse failure.
 * @param iso - ISO datetime string
 */
export function fmt(iso: string) {
  try {
    return format(parseISO(iso), 'd MMM yyyy HH:mm');
  } catch {
    return iso;
  }
}
