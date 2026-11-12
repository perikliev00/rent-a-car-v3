/**
 * Staff-only SSE realtime: maps domain events to toasts and React Query
 * invalidation. Suppresses echo toasts shortly after local mutations.
 */
import { useEffect, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  ADMIN_REALTIME_EVENT_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  getAdminRealtimeStreamUrl,
  // Contribute this line to the enclosing declaration or statement.
  isHighSignalRealtimeType,
  // Declare the AdminRealtimeEvent TypeScript type alias.
  type AdminRealtimeEvent,
  // Declare the AdminRealtimeEventType TypeScript type alias.
  type AdminRealtimeEventType,
// Contribute this line to the enclosing declaration or statement.
} from '../api/admin/realtime';
// Import named exports from '../auth/usePermission'.
import { useIsStaff } from '../auth/usePermission';
// Import named exports from '../components/ui/toastStore'.
import { toast, type ToastType } from '../components/ui/toastStore';

// Continue the surrounding logic with this statement.
const TOAST_TYPE_BY_EVENT: Partial<Record<AdminRealtimeEventType, ToastType>> = {
  // Provide the new booking field value.
  new_booking: 'info',
  // Provide the payment succeeded field value.
  payment_succeeded: 'success',
  // Provide the payment failed field value.
  payment_failed: 'error',
  // Provide the reservation confirmed field value.
  reservation_confirmed: 'success',
  // Provide the car returned field value.
  car_returned: 'success',
  // Provide the manual review needed field value.
  manual_review_needed: 'error',
  // Provide the paid but not confirmed field value.
  paid_but_not_confirmed: 'info',
};

/** Window after a local write during which matching SSE echoes are ignored. */
export const LOCAL_MUTATION_ECHO_MS = 1500;

// Create the reservation echo event types constant.
const RESERVATION_ECHO_EVENT_TYPES = new Set<string>([
  // Supply the literal value used by the enclosing expression.
  'reservation_confirmed',
  // Supply the literal value used by the enclosing expression.
  'reservation_updated',
  // Supply the literal value used by the enclosing expression.
  'car_returned',
]);

/** Query-key prefixes invalidated per realtime event type. */
const KEYS = {
  // Provide the reservations field value.
  reservations: ['admin', 'reservations'],
  // Provide the dashboard field value.
  dashboard: ['admin', 'dashboard'],
  // Provide the calendar field value.
  calendar: ['admin', 'calendar'],
  // Provide the orders field value.
  orders: ['admin', 'orders'],
  // Provide the payments field value.
  payments: ['admin', 'payments'],
  // Provide the tasks field value.
  tasks: ['admin', 'tasks'],
  // Provide the cars field value.
  cars: ['admin', 'cars'],
  // Provide the fleet alerts field value.
  fleetAlerts: ['admin', 'fleet-alerts'],
// Apply the TypeScript type assertion for this value.
} as const;

// Initialize the mutable last local mutation at variable.
let lastLocalMutationAt = 0;

/**
 * Call after a successful local admin mutation to suppress SSE echo noise.
 * @param at - Timestamp of the local mutation (default now)
 */
export function noteLocalAdminMutation(at = Date.now()) {
  // Update lastLocalMutationAt with the right-hand side value.
  lastLocalMutationAt = at;
}

/**
 * True when a reservation echo should be ignored (recent local mutation).
 * @param type - SSE event type
 * @param now - Comparison timestamp (default now)
 */
export function shouldSuppressReservationEcho(type: string, now = Date.now()) {
  // Evaluate the condition and enter the branch when it is true.
  if (!RESERVATION_ECHO_EVENT_TYPES.has(type)) return false;
  // Create the elapsed constant.
  const elapsed = now - lastLocalMutationAt;
  // Return the resulting value to the caller.
  return elapsed >= 0 && elapsed < LOCAL_MUTATION_ECHO_MS;
}

/**
 * Parse SSE `data` JSON into an {@link AdminRealtimeEvent}, or null if invalid.
 * @param raw - MessageEvent data string
 */
function parseEventData(raw: string): AdminRealtimeEvent | null {
  // Start a try block for operations that may fail.
  try {
    // Create the parsed constant.
    const parsed = JSON.parse(raw) as AdminRealtimeEvent;
    // Require a plain object with a string `type`.
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      // Return the resulting value to the caller.
      return null;
    }
    // Return the resulting value to the caller.
    return parsed;
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return null;
  }
}

/**
 * Map an SSE event type to the React Query key prefixes that should invalidate.
 * @param type - Domain event type string
 */
export function queryKeysForRealtimeEvent(type: string): readonly (readonly string[])[] {
  // Choose a branch from the switch expression.
  switch (type) {
    // Handle this discrete switch case.
    case 'new_booking':
    // Handle this discrete switch case.
    case 'reservation_confirmed':
    // Handle this discrete switch case.
    case 'reservation_updated':
      // Return the resulting value to the caller.
      return [KEYS.reservations, KEYS.dashboard, KEYS.calendar, KEYS.orders];
    // Handle this discrete switch case.
    case 'payment_succeeded':
    // Handle this discrete switch case.
    case 'payment_failed':
    // Handle this discrete switch case.
    case 'paid_but_not_confirmed':
      // Return the resulting value to the caller.
      return [KEYS.payments, KEYS.reservations, KEYS.dashboard, KEYS.orders];
    // Handle this discrete switch case.
    case 'manual_review_needed':
      // Return the resulting value to the caller.
      return [KEYS.reservations, KEYS.dashboard, KEYS.payments, KEYS.orders];
    // Handle this discrete switch case.
    case 'car_returned':
      // Return the resulting value to the caller.
      return [
        // Contribute this line to the enclosing declaration or statement.
        KEYS.reservations,
        // Contribute this line to the enclosing declaration or statement.
        KEYS.dashboard,
        // Contribute this line to the enclosing declaration or statement.
        KEYS.calendar,
        // Contribute this line to the enclosing declaration or statement.
        KEYS.orders,
        // Contribute this line to the enclosing declaration or statement.
        KEYS.cars,
        // Contribute this line to the enclosing declaration or statement.
        KEYS.fleetAlerts,
      ];
    // Handle this discrete switch case.
    case 'calendar_updated':
      // Return the resulting value to the caller.
      return [KEYS.calendar, KEYS.tasks];
    // Handle the default switch path.
    default:
      // Return the resulting value to the caller.
      return [];
  }
}

/**
 * Invalidate all React Query caches associated with a realtime event type.
 * @param queryClient - App QueryClient
 * @param type - Domain event type string
 */
export function invalidateAdminCachesForEvent(queryClient: QueryClient, type: string) {
  // Iterate using the loop initializer, condition, and step.
  for (const queryKey of queryKeysForRealtimeEvent(type)) {
    // Spread into a mutable array — invalidateQueries expects QueryKey.
    void queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
}

// Export the admin realtime connection state type.
export type AdminRealtimeConnectionState = 'idle' | 'connecting' | 'live' | 'offline';

/**
 * Opens a staff-only SSE stream and surfaces domain events as toasts + cache invalidation.
 * Toast policy: only high-signal types toast; reservation_updated / calendar_updated are silent.
 */
export function useAdminRealtime(): AdminRealtimeConnectionState {
  // Create the is staff constant.
  const isStaff = useIsStaff();
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [state, setState] = useState<AdminRealtimeConnectionState>('idle');

  // Call useEffect to perform this step.
  useEffect(() => {
    // Guests/non-staff never open the stream.
    if (!isStaff) {
      // Call setState to perform this step.
      setState('idle');
      // Return control to the caller with the following value.
      return;
    }

    // Initialize the mutable closed variable.
    let closed = false;
    // Continue the surrounding logic with this statement.
    let source: EventSource | null = null;
    // Call setState to perform this step.
    setState('connecting');

    // Start a try block for operations that may fail.
    try {
      // Cookie session via withCredentials.
      source = new EventSource(getAdminRealtimeStreamUrl(), { withCredentials: true });
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // Call setState to perform this step.
      setState('offline');
      // Return control to the caller with the following value.
      return;
    }

    // Update source.onopen with the right-hand side value.
    source.onopen = () => {
      // Evaluate the condition and enter the branch when it is true.
      if (!closed) setState('live');
    };

    // Update source.onerror with the right-hand side value.
    source.onerror = () => {
      // Evaluate the condition and enter the branch when it is true.
      if (!closed) setState('offline');
    };

    // Heartbeat keeps the UI in “live” even without domain events.
    const onPing = () => {
      // Evaluate the condition and enter the branch when it is true.
      if (!closed) setState('live');
    };

    // Call source.addEventListener to perform this step.
    source.addEventListener('ping', onPing);

    // One listener per catalogued event type.
    const handlers = ADMIN_REALTIME_EVENT_TYPES.map((type) => {
      // Create the handler constant.
      const handler = (evt: Event) => {
        // Create the message constant.
        const message = evt as MessageEvent<string>;
        // Create the payload constant.
        const payload = parseEventData(message.data);
        // Evaluate the condition and enter the branch when it is true.
        if (!payload) return;

        // Skip toast/invalidation when we just wrote locally (echo suppression).
        if (shouldSuppressReservationEcho(type)) {
          // Return control to the caller with the following value.
          return;
        }

        // Evaluate the condition and enter the branch when it is true.
        if (isHighSignalRealtimeType(type)) {
          // Create the toast type constant.
          const toastType = TOAST_TYPE_BY_EVENT[type] ?? 'info';
          // Call toast to perform this step.
          toast(payload.message || type, toastType);
        }
        // Call invalidateAdminCachesForEvent to perform this step.
        invalidateAdminCachesForEvent(queryClient, type);
      };
      // Continue the surrounding logic with this statement.
      source!.addEventListener(type, handler);
      // Return the resulting value to the caller.
      return { type, handler };
    });

    // Return the resulting value to the caller.
    return () => {
      // Update closed with the right-hand side value.
      closed = true;
      // Continue the surrounding logic with this statement.
      source?.removeEventListener('ping', onPing);
      // Iterate using the loop initializer, condition, and step.
      for (const { type, handler } of handlers) {
        // Continue the surrounding logic with this statement.
        source?.removeEventListener(type, handler);
      }
      // Continue the surrounding logic with this statement.
      source?.close();
      // Call setState to perform this step.
      setState('idle');
    };
  // Continue the surrounding logic with this statement.
  }, [isStaff, queryClient]);

  // Return the resulting value to the caller.
  return state;
}

// Re-export the listed bindings.
export { TOAST_TYPE_BY_EVENT, parseEventData, RESERVATION_ECHO_EVENT_TYPES };
