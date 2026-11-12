/**
 * Human-readable title for the visible calendar date range.
 */
import { format, isSameDay, isSameMonth, isSameYear } from 'date-fns';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarViewMode } from './calendar.types';

/**
 * Toolbar title for day / week / month based on the visible `[from, to]` window.
 *
 * @param view - Active calendar view mode
 * @param from - Range start
 * @param to - Range end
 */
export function formatCalendarRangeTitle(view: CalendarViewMode, from: Date, to: Date): string {
  // Evaluate the condition and enter the branch when it is true.
  if (view === 'day') {
    // Return the resulting value to the caller.
    return format(from, 'EEEE, d MMM yyyy');
  }
  // Evaluate the condition and enter the branch when it is true.
  if (view === 'month') {
    // Return the resulting value to the caller.
    return format(from, 'MMMM yyyy');
  }
  // Week view: compress when same day/month/year to avoid redundant labels.
  if (isSameDay(from, to)) return format(from, 'd MMM yyyy');
  // Evaluate the condition and enter the branch when it is true.
  if (isSameMonth(from, to) && isSameYear(from, to)) {
    // Return the resulting value to the caller.
    return `${format(from, 'd')}–${format(to, 'd MMM yyyy')}`;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (isSameYear(from, to)) {
    // Return the resulting value to the caller.
    return `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`;
  }
  // Return the resulting value to the caller.
  return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`;
}
