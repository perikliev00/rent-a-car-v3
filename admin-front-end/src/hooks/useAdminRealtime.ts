/**
 * Staff-only SSE realtime: maps domain events to toasts and React Query
 * invalidation. Suppresses echo toasts shortly after local mutations.
 */
import { useEffect, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  ADMIN_REALTIME_EVENT_TYPES,
  getAdminRealtimeStreamUrl,
  isHighSignalRealtimeType,
  type AdminRealtimeEvent,
  type AdminRealtimeEventType,
} from '../api/admin/realtime';
import { useIsStaff } from '../auth/usePermission';
import { toast, type ToastType } from '../components/ui/toastStore';

const TOAST_TYPE_BY_EVENT: Partial<Record<AdminRealtimeEventType, ToastType>> = {
  new_booking: 'info',
  payment_succeeded: 'success',
  payment_failed: 'error',
  reservation_confirmed: 'success',
  car_returned: 'success',
  manual_review_needed: 'error',
  paid_but_not_confirmed: 'info',
};

/** Window after a local write during which matching SSE echoes are ignored. */
export const LOCAL_MUTATION_ECHO_MS = 1500;

const RESERVATION_ECHO_EVENT_TYPES = new Set<string>([
  'reservation_confirmed',
  'reservation_updated',
  'car_returned',
]);

/** Query-key prefixes invalidated per realtime event type. */
const KEYS = {
  reservations: ['admin', 'reservations'],
  dashboard: ['admin', 'dashboard'],
  calendar: ['admin', 'calendar'],
  orders: ['admin', 'orders'],
  payments: ['admin', 'payments'],
  tasks: ['admin', 'tasks'],
  cars: ['admin', 'cars'],
  fleetAlerts: ['admin', 'fleet-alerts'],
} as const;

let lastLocalMutationAt = 0;

/**
 * Call after a successful local admin mutation to suppress SSE echo noise.
 * @param at - Timestamp of the local mutation (default now)
 */
export function noteLocalAdminMutation(at = Date.now()) {
  lastLocalMutationAt = at;
}

/**
 * True when a reservation echo should be ignored (recent local mutation).
 * @param type - SSE event type
 * @param now - Comparison timestamp (default now)
 */
export function shouldSuppressReservationEcho(type: string, now = Date.now()) {
  if (!RESERVATION_ECHO_EVENT_TYPES.has(type)) return false;
  const elapsed = now - lastLocalMutationAt;
  return elapsed >= 0 && elapsed < LOCAL_MUTATION_ECHO_MS;
}

/**
 * Parse SSE `data` JSON into an {@link AdminRealtimeEvent}, or null if invalid.
 * @param raw - MessageEvent data string
 */
function parseEventData(raw: string): AdminRealtimeEvent | null {
  try {
    const parsed = JSON.parse(raw) as AdminRealtimeEvent;
    // Require a plain object with a string `type`.
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Map an SSE event type to the React Query key prefixes that should invalidate.
 * @param type - Domain event type string
 */
export function queryKeysForRealtimeEvent(type: string): readonly (readonly string[])[] {
  switch (type) {
    case 'new_booking':
    case 'reservation_confirmed':
    case 'reservation_updated':
      return [KEYS.reservations, KEYS.dashboard, KEYS.calendar, KEYS.orders];
    case 'payment_succeeded':
    case 'payment_failed':
    case 'paid_but_not_confirmed':
      return [KEYS.payments, KEYS.reservations, KEYS.dashboard, KEYS.orders];
    case 'manual_review_needed':
      return [KEYS.reservations, KEYS.dashboard, KEYS.payments, KEYS.orders];
    case 'car_returned':
      return [
        KEYS.reservations,
        KEYS.dashboard,
        KEYS.calendar,
        KEYS.orders,
        KEYS.cars,
        KEYS.fleetAlerts,
      ];
    case 'calendar_updated':
      return [KEYS.calendar, KEYS.tasks];
    default:
      return [];
  }
}

/**
 * Invalidate all React Query caches associated with a realtime event type.
 * @param queryClient - App QueryClient
 * @param type - Domain event type string
 */
export function invalidateAdminCachesForEvent(queryClient: QueryClient, type: string) {
  for (const queryKey of queryKeysForRealtimeEvent(type)) {
    // Spread into a mutable array — invalidateQueries expects QueryKey.
    void queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
}

export type AdminRealtimeConnectionState = 'idle' | 'connecting' | 'live' | 'offline';

/**
 * Opens a staff-only SSE stream and surfaces domain events as toasts + cache invalidation.
 * Toast policy: only high-signal types toast; reservation_updated / calendar_updated are silent.
 */
export function useAdminRealtime(): AdminRealtimeConnectionState {
  const isStaff = useIsStaff();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AdminRealtimeConnectionState>('idle');

  useEffect(() => {
    // Guests/non-staff never open the stream.
    if (!isStaff) {
      setState('idle');
      return;
    }

    let closed = false;
    let source: EventSource | null = null;
    setState('connecting');

    try {
      // Cookie session via withCredentials.
      source = new EventSource(getAdminRealtimeStreamUrl(), { withCredentials: true });
    } catch {
      setState('offline');
      return;
    }

    source.onopen = () => {
      if (!closed) setState('live');
    };

    source.onerror = () => {
      if (!closed) setState('offline');
    };

    // Heartbeat keeps the UI in “live” even without domain events.
    const onPing = () => {
      if (!closed) setState('live');
    };

    source.addEventListener('ping', onPing);

    // One listener per catalogued event type.
    const handlers = ADMIN_REALTIME_EVENT_TYPES.map((type) => {
      const handler = (evt: Event) => {
        const message = evt as MessageEvent<string>;
        const payload = parseEventData(message.data);
        if (!payload) return;

        // Skip toast/invalidation when we just wrote locally (echo suppression).
        if (shouldSuppressReservationEcho(type)) {
          return;
        }

        if (isHighSignalRealtimeType(type)) {
          const toastType = TOAST_TYPE_BY_EVENT[type] ?? 'info';
          toast(payload.message || type, toastType);
        }
        invalidateAdminCachesForEvent(queryClient, type);
      };
      source!.addEventListener(type, handler);
      return { type, handler };
    });

    return () => {
      closed = true;
      source?.removeEventListener('ping', onPing);
      for (const { type, handler } of handlers) {
        source?.removeEventListener(type, handler);
      }
      source?.close();
      setState('idle');
    };
  }, [isStaff, queryClient]);

  return state;
}

export { TOAST_TYPE_BY_EVENT, parseEventData, RESERVATION_ECHO_EVENT_TYPES };
