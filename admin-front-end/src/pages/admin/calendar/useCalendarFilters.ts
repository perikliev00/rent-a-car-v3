/**
 * URL/state sync for calendar filter query params.
 */
import { useMemo } from 'react';
// Import named exports from 'react-router-dom'.
import { useSearchParams } from 'react-router-dom';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarFiltersState, CalendarViewMode } from './calendar.types';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  addDays,
  // Contribute this line to the enclosing declaration or statement.
  addMonths,
  // Contribute this line to the enclosing declaration or statement.
  endOfDay,
  // Contribute this line to the enclosing declaration or statement.
  endOfMonth,
  // Contribute this line to the enclosing declaration or statement.
  endOfWeek,
  // Contribute this line to the enclosing declaration or statement.
  formatISO,
  // Contribute this line to the enclosing declaration or statement.
  startOfDay,
  // Contribute this line to the enclosing declaration or statement.
  startOfMonth,
  // Contribute this line to the enclosing declaration or statement.
  startOfWeek,
// Contribute this line to the enclosing declaration or statement.
} from 'date-fns';

// Continue the surrounding logic with this statement.
const emptyFilters: CalendarFiltersState = {
  // Provide the category id field value.
  categoryId: '',
  // Provide the transmission field value.
  transmission: '',
  // Provide the fuel type field value.
  fuelType: '',
  // Provide the car status field value.
  carStatus: '',
  // Provide the location field value.
  location: '',
  // Provide the reservation status field value.
  reservationStatus: '',
  // Provide the event type field value.
  eventType: '',
  // Provide the staff user id field value.
  staffUserId: '',
};

/**
 * Calendar view/filters live in the URL so deep-links and role presets share one source of truth.
 * Week ranges start on Monday to match EU ops calendars.
 */
export function useCalendarFilters() {
  // Destructure array values into local variables.
  const [params, setParams] = useSearchParams();

  // Create the view constant.
  const view = (params.get('view') as CalendarViewMode) || 'week';
  // Create the anchor constant.
  const anchor = params.get('date') || formatISO(new Date(), { representation: 'date' });

  // Continue the surrounding logic with this statement.
  const filters: CalendarFiltersState = {
    // Provide the category id field value.
    categoryId: params.get('categoryId') || '',
    // Provide the transmission field value.
    transmission: params.get('transmission') || '',
    // Provide the fuel type field value.
    fuelType: params.get('fuelType') || '',
    // Provide the car status field value.
    carStatus: params.get('carStatus') || '',
    // Provide the location field value.
    location: params.get('location') || '',
    // Provide the reservation status field value.
    reservationStatus: params.get('reservationStatus') || '',
    // Provide the event type field value.
    eventType: params.get('eventType') || '',
    // Provide the staff user id field value.
    staffUserId: params.get('staffUserId') || '',
  };

  // Create the range constant.
  const range = useMemo(() => {
    // Noon anchor avoids DST edge cases when converting date-only strings.
    const base = new Date(`${anchor}T12:00:00`);
    // Evaluate the condition and enter the branch when it is true.
    if (view === 'day') {
      // Return the resulting value to the caller.
      return { from: startOfDay(base), to: endOfDay(base), density: 'timeline' as const };
    }
    // Evaluate the condition and enter the branch when it is true.
    if (view === 'month') {
      // Return the resulting value to the caller.
      return {
        // Provide the from field value.
        from: startOfMonth(base),
        // Provide the to field value.
        to: endOfMonth(base),
        // Provide the density field value.
        density: 'month' as const,
      };
    }
    // Return the resulting value to the caller.
    return {
      // Provide the from field value.
      from: startOfWeek(base, { weekStartsOn: 1 }),
      // Provide the to field value.
      to: endOfWeek(base, { weekStartsOn: 1 }),
      // Provide the density field value.
      density: 'timeline' as const,
    };
  // Continue the surrounding logic with this statement.
  }, [anchor, view]);

  /** Persist view mode in the URL search params. */
  function setView(next: CalendarViewMode) {
    // Create the next params constant.
    const nextParams = new URLSearchParams(params);
    // Call nextParams.set to perform this step.
    nextParams.set('view', next);
    // Call setParams to perform this step.
    setParams(nextParams);
  }

  /** Persist the calendar anchor date (`date=`) in the URL. */
  function setAnchor(date: string) {
    // Create the next params constant.
    const nextParams = new URLSearchParams(params);
    // Call nextParams.set to perform this step.
    nextParams.set('date', date);
    // Call setParams to perform this step.
    setParams(nextParams);
  }

  /** Shift the anchor by a fixed number of days (noon-local to avoid DST skew). */
  function shift(days: number) {
    // Create the base constant.
    const base = new Date(`${anchor}T12:00:00`);
    // Create the next constant.
    const next = addDays(base, days);
    // Call setAnchor to perform this step.
    setAnchor(formatISO(next, { representation: 'date' }));
  }

  /** Prev/next navigation sized to the active view (day/week/month). */
  function shiftByView(direction: -1 | 1) {
    // Create the base constant.
    const base = new Date(`${anchor}T12:00:00`);
    // Evaluate the condition and enter the branch when it is true.
    if (view === 'month') {
      // Call setAnchor to perform this step.
      setAnchor(formatISO(addMonths(base, direction), { representation: 'date' }));
      // Return control to the caller with the following value.
      return;
    }
    // Evaluate the condition and enter the branch when it is true.
    if (view === 'day') {
      // Call shift to perform this step.
      shift(direction);
      // Return control to the caller with the following value.
      return;
    }
    // Week view: jump by 7 days.
    shift(direction * 7);
  }

  /** Set or clear one filter key in the URL (empty values delete the param). */
  function setFilter<K extends keyof CalendarFiltersState>(key: K, value: CalendarFiltersState[K]) {
    // Create the next params constant.
    const nextParams = new URLSearchParams(params);
    // Evaluate the condition and enter the branch when it is true.
    if (!value) nextParams.delete(key);
    // Run the fallback path after earlier conditions failed.
    else nextParams.set(key, value);
    // Call setParams to perform this step.
    setParams(nextParams);
  }

  /** Drop all filters but keep the current view + anchor date. */
  function clearFilters() {
    // Create the next params constant.
    const nextParams = new URLSearchParams();
    // Call nextParams.set to perform this step.
    nextParams.set('view', view);
    // Call nextParams.set to perform this step.
    nextParams.set('date', anchor);
    // Call setParams to perform this step.
    setParams(nextParams);
  }

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    view,
    // Contribute this line to the enclosing declaration or statement.
    anchor,
    // Contribute this line to the enclosing declaration or statement.
    filters,
    // Contribute this line to the enclosing declaration or statement.
    range,
    // Contribute this line to the enclosing declaration or statement.
    emptyFilters,
    // Contribute this line to the enclosing declaration or statement.
    setView,
    // Contribute this line to the enclosing declaration or statement.
    setAnchor,
    // Contribute this line to the enclosing declaration or statement.
    shift,
    // Contribute this line to the enclosing declaration or statement.
    shiftByView,
    // Contribute this line to the enclosing declaration or statement.
    setFilter,
    // Contribute this line to the enclosing declaration or statement.
    clearFilters,
    // Contribute this line to the enclosing declaration or statement.
    setParams,
    // Contribute this line to the enclosing declaration or statement.
    params,
  };
}
