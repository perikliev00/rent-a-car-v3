import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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

function parseEventData(raw: string): AdminRealtimeEvent | null {
  try {
    const parsed = JSON.parse(raw) as AdminRealtimeEvent;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Invalidate admin views affected by booking/ops/calendar live events.
 * Prefix keys cover nested queries (calendar events/day/event, order detail, etc.).
 */
function invalidateAdminCaches(queryClient: ReturnType<typeof useQueryClient>) {
  const keys = [
    ['admin', 'reservations'],
    ['admin', 'reservations', 'ops-dashboard'],
    ['admin', 'dashboard'],
    ['admin', 'payments'],
    ['admin', 'calendar'],
    ['admin', 'tasks'],
    ['admin', 'orders'],
    ['admin', 'cancellation-requests'],
    ['admin', 'notifications'],
    ['admin', 'cars'],
    ['admin', 'fleet-alerts'],
  ] as const;

  for (const queryKey of keys) {
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
    if (!isStaff) {
      setState('idle');
      return;
    }

    let closed = false;
    let source: EventSource | null = null;
    setState('connecting');

    try {
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

    const onPing = () => {
      if (!closed) setState('live');
    };

    source.addEventListener('ping', onPing);

    const handlers = ADMIN_REALTIME_EVENT_TYPES.map((type) => {
      const handler = (evt: Event) => {
        const message = evt as MessageEvent<string>;
        const payload = parseEventData(message.data);
        if (!payload) return;

        if (isHighSignalRealtimeType(type)) {
          const toastType = TOAST_TYPE_BY_EVENT[type] ?? 'info';
          toast(payload.message || type, toastType);
        }
        invalidateAdminCaches(queryClient);
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

export { TOAST_TYPE_BY_EVENT, parseEventData, invalidateAdminCaches };
