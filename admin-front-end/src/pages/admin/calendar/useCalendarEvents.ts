import { useQuery } from '@tanstack/react-query';
import { getCalendarEvents } from '../../../api/admin/calendar';
import type { CalendarEvent, CalendarFiltersState } from './calendar.types';

function parseEventTypes(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function useCalendarEvents(args: {
  from: Date;
  to: Date;
  density: string;
  filters: CalendarFiltersState;
  enabled?: boolean;
}) {
  const eventTypes = parseEventTypes(args.filters.eventType);
  const multiType = eventTypes.length > 1;
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
