/**
 * Local date/time formatting for event detail rows.
 */
import { format, parseISO } from 'date-fns';

/**
 * Format an ISO timestamp for event detail rows; returns raw input on parse failure.
 * @param iso - ISO datetime string
 */
export function fmt(iso: string) {
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return format(parseISO(iso), 'd MMM yyyy HH:mm');
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return iso;
  }
}
