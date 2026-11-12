/**
 * React Query loader for calendar cars/events in the active range.
 */
import { useQuery } from '@tanstack/react-query';
// Import named exports from '../../../api/admin/calendar'.
import { getCalendarEvents } from '../../../api/admin/calendar';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarEvent, CalendarFiltersState } from './calendar.types';

/**
 * Split a comma-separated eventType filter into trimmed type keys.
 * @param raw - Filter string from URL/UI state
 */
function parseEventTypes(raw: string): string[] {
  // Return the resulting value to the caller.
  return raw
    // Call .split to perform this step.
    .split(',')
    // Call .map to perform this step.
    .map((s) => s.trim())
    // Call .filter to perform this step.
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
  // Provide the from field value.
  from: Date;
  // Provide the to field value.
  to: Date;
  // Provide the density field value.
  density: string;
  // Provide the filters field value.
  filters: CalendarFiltersState;
  // Contribute this line to the enclosing declaration or statement.
  enabled?: boolean;
// Continue the surrounding logic with this statement.
}) {
  // Create the event types constant.
  const eventTypes = parseEventTypes(args.filters.eventType);
  // Create the multi type constant.
  const multiType = eventTypes.length > 1;
  // Single type can be sent to the API; multiple require client filtering.
  const apiEventType = eventTypes.length === 1 ? eventTypes[0] : undefined;

  // Return the resulting value to the caller.
  return useQuery({
    // Provide the query key field value.
    queryKey: [
      // Supply the literal value used by the enclosing expression.
      'admin',
      // Supply the literal value used by the enclosing expression.
      'calendar',
      // Supply the literal value used by the enclosing expression.
      'events',
      // Call args.from.toISOString to perform this step.
      args.from.toISOString(),
      // Call args.to.toISOString to perform this step.
      args.to.toISOString(),
      // Contribute this line to the enclosing declaration or statement.
      args.density,
      // Contribute this line to the enclosing declaration or statement.
      args.filters,
    ],
    // Provide the query fn field value.
    queryFn: async () => {
      // Create the data constant.
      const data = await getCalendarEvents({
        // Provide the from field value.
        from: args.from.toISOString(),
        // Provide the to field value.
        to: args.to.toISOString(),
        // Provide the density field value.
        density: args.density,
        // Provide the category id field value.
        categoryId: args.filters.categoryId || undefined,
        // Provide the transmission field value.
        transmission: args.filters.transmission || undefined,
        // Provide the fuel type field value.
        fuelType: args.filters.fuelType || undefined,
        // Provide the car status field value.
        carStatus: args.filters.carStatus || undefined,
        // Provide the location field value.
        location: args.filters.location || undefined,
        // Provide the reservation status field value.
        reservationStatus: args.filters.reservationStatus || undefined,
        // Provide the event type field value.
        eventType: apiEventType,
        // Provide the staff user id field value.
        staffUserId: args.filters.staffUserId || undefined,
      });
      // No multi-select → return server payload as-is.
      if (!multiType) return data;
      // Create the allow constant.
      const allow = new Set(eventTypes);
      // Return the resulting value to the caller.
      return {
        // Spread data into the surrounding structure.
        ...data,
        // Provide the events field value.
        events: data.events.filter((e: CalendarEvent) => allow.has(e.type)),
      };
    },
    // Provide the enabled field value.
    enabled: args.enabled !== false,
    // Provide the stale time field value.
    staleTime: 30_000,
  });
}
