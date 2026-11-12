/**
 * URL/state sync for calendar filter query params.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CalendarFiltersState, CalendarViewMode } from './calendar.types';
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  formatISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

const emptyFilters: CalendarFiltersState = {
  categoryId: '',
  transmission: '',
  fuelType: '',
  carStatus: '',
  location: '',
  reservationStatus: '',
  eventType: '',
  staffUserId: '',
};

/**
 * Calendar view/filters live in the URL so deep-links and role presets share one source of truth.
 * Week ranges start on Monday to match EU ops calendars.
 */
export function useCalendarFilters() {
  const [params, setParams] = useSearchParams();

  const view = (params.get('view') as CalendarViewMode) || 'week';
  const anchor = params.get('date') || formatISO(new Date(), { representation: 'date' });

  const filters: CalendarFiltersState = {
    categoryId: params.get('categoryId') || '',
    transmission: params.get('transmission') || '',
    fuelType: params.get('fuelType') || '',
    carStatus: params.get('carStatus') || '',
    location: params.get('location') || '',
    reservationStatus: params.get('reservationStatus') || '',
    eventType: params.get('eventType') || '',
    staffUserId: params.get('staffUserId') || '',
  };

  const range = useMemo(() => {
    // Noon anchor avoids DST edge cases when converting date-only strings.
    const base = new Date(`${anchor}T12:00:00`);
    if (view === 'day') {
      return { from: startOfDay(base), to: endOfDay(base), density: 'timeline' as const };
    }
    if (view === 'month') {
      return {
        from: startOfMonth(base),
        to: endOfMonth(base),
        density: 'month' as const,
      };
    }
    return {
      from: startOfWeek(base, { weekStartsOn: 1 }),
      to: endOfWeek(base, { weekStartsOn: 1 }),
      density: 'timeline' as const,
    };
  }, [anchor, view]);

  /** Persist view mode in the URL search params. */
  function setView(next: CalendarViewMode) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('view', next);
    setParams(nextParams);
  }

  /** Persist the calendar anchor date (`date=`) in the URL. */
  function setAnchor(date: string) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('date', date);
    setParams(nextParams);
  }

  /** Shift the anchor by a fixed number of days (noon-local to avoid DST skew). */
  function shift(days: number) {
    const base = new Date(`${anchor}T12:00:00`);
    const next = addDays(base, days);
    setAnchor(formatISO(next, { representation: 'date' }));
  }

  /** Prev/next navigation sized to the active view (day/week/month). */
  function shiftByView(direction: -1 | 1) {
    const base = new Date(`${anchor}T12:00:00`);
    if (view === 'month') {
      setAnchor(formatISO(addMonths(base, direction), { representation: 'date' }));
      return;
    }
    if (view === 'day') {
      shift(direction);
      return;
    }
    // Week view: jump by 7 days.
    shift(direction * 7);
  }

  /** Set or clear one filter key in the URL (empty values delete the param). */
  function setFilter<K extends keyof CalendarFiltersState>(key: K, value: CalendarFiltersState[K]) {
    const nextParams = new URLSearchParams(params);
    if (!value) nextParams.delete(key);
    else nextParams.set(key, value);
    setParams(nextParams);
  }

  /** Drop all filters but keep the current view + anchor date. */
  function clearFilters() {
    const nextParams = new URLSearchParams();
    nextParams.set('view', view);
    nextParams.set('date', anchor);
    setParams(nextParams);
  }

  return {
    view,
    anchor,
    filters,
    range,
    emptyFilters,
    setView,
    setAnchor,
    shift,
    shiftByView,
    setFilter,
    clearFilters,
    setParams,
    params,
  };
}
