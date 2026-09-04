import { format, isSameDay, isSameMonth, isSameYear } from 'date-fns';
import type { CalendarViewMode } from './calendar.types';

export function formatCalendarRangeTitle(view: CalendarViewMode, from: Date, to: Date): string {
  if (view === 'day') {
    return format(from, 'EEEE, d MMM yyyy');
  }
  if (view === 'month') {
    return format(from, 'MMMM yyyy');
  }
  // week
  if (isSameDay(from, to)) return format(from, 'd MMM yyyy');
  if (isSameMonth(from, to) && isSameYear(from, to)) {
    return `${format(from, 'd')}–${format(to, 'd MMM yyyy')}`;
  }
  if (isSameYear(from, to)) {
    return `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`;
  }
  return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`;
}
