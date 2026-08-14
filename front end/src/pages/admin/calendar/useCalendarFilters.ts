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

  function setView(next: CalendarViewMode) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('view', next);
    setParams(nextParams);
  }

  function setAnchor(date: string) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('date', date);
    setParams(nextParams);
  }

  function shift(days: number) {
    const base = new Date(`${anchor}T12:00:00`);
    const next = addDays(base, days);
    setAnchor(formatISO(next, { representation: 'date' }));
  }

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
    shift(direction * 7);
  }

  function setFilter<K extends keyof CalendarFiltersState>(key: K, value: CalendarFiltersState[K]) {
    const nextParams = new URLSearchParams(params);
    if (!value) nextParams.delete(key);
    else nextParams.set(key, value);
    setParams(nextParams);
  }

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
