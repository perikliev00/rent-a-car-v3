/**
 * React Query loader for calendar cars/events in the active range.
 */
import { useQuery } from '@tanstack/react-query';
import { getCalendarEvents } from '../../../api/admin/calendar';
import type { CalendarEvent, CalendarFiltersState } from './calendar.types';

/**
 * Split a comma-separated eventType filter into trimmed type keys.
 * @param raw - Filter string from URL/UI state
 */
function parseEventTypes(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Load cars + events for `[from, to]` with the active filters.
 * When multiple event types are selected, the API is called without `eventType`
 * and results are filtered client-side (API accepts a single type).
 *
 * @param args.from - Range start
 * @param args.to - Range end
 * @param args.density - Density hint forwarded to the API
 * @param args.filters - Calendar filter state
 * @param args.enabled - When false, the query does not run (default true)
 */
export function useCalendarEvents(args: {
  from: Date;
  to: Date;
  density: string;
  filters: CalendarFiltersState;
  enabled?: boolean;
}) {
  const eventTypes = parseEventTypes(args.filters.eventType);
  const multiType = eventTypes.length > 1;
  // Single type can be sent to the API; multiple require client filtering.
  const apiEventType = eventTypes.length === 1 ? eventTypes[0] : undefined;

  return useQuery({
    queryKey: [
      'admin',
      'calendar',
      'events',
      args.from.toISOString(),
      args.to.toISOString(),
      args.density,
      args.filters,
    ],
    queryFn: async () => {
      const data = await getCalendarEvents({
        from: args.from.toISOString(),
        to: args.to.toISOString(),
        density: args.density,
        categoryId: args.filters.categoryId || undefined,
        transmission: args.filters.transmission || undefined,
        fuelType: args.filters.fuelType || undefined,
        carStatus: args.filters.carStatus || undefined,
        location: args.filters.location || undefined,
        reservationStatus: args.filters.reservationStatus || undefined,
        eventType: apiEventType,
        staffUserId: args.filters.staffUserId || undefined,
      });
      // No multi-select → return server payload as-is.
      if (!multiType) return data;
      const allow = new Set(eventTypes);
      return {
        ...data,
        events: data.events.filter((e: CalendarEvent) => allow.has(e.type)),
      };
    },
    enabled: args.enabled !== false,
    staleTime: 30_000,
  });
}
