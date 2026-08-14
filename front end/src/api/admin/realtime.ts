import { API_BASE, toVersionedApiPath } from '../client';

export const ADMIN_REALTIME_EVENT_TYPES = [
  'new_booking',
  'payment_succeeded',
  'payment_failed',
  'reservation_confirmed',
  'car_returned',
  'manual_review_needed',
  'paid_but_not_confirmed',
  'reservation_updated',
  'calendar_updated',
] as const;

export type AdminRealtimeEventType = (typeof ADMIN_REALTIME_EVENT_TYPES)[number];

/** Toast only these — quiet types still invalidate caches. */
export const HIGH_SIGNAL_REALTIME_TYPES = [
  'new_booking',
  'payment_succeeded',
  'payment_failed',
  'reservation_confirmed',
  'car_returned',
  'manual_review_needed',
  'paid_but_not_confirmed',
] as const;

export type AdminRealtimeEvent = {
  id: string;
  type: AdminRealtimeEventType | string;
  occurredAt: string;
  reservationId: string | null;
  orderId: string | null;
  carId: string | null;
  carName: string | null;
  customerName: string | null;
  status: string | null;
  oldStatus: string | null;
  message: string;
  meta: Record<string, unknown>;
};

export function getAdminRealtimeStreamUrl(): string {
  return `${API_BASE}${toVersionedApiPath('/api/admin/realtime/stream')}`;
}

export function isAdminRealtimeEventType(value: string): value is AdminRealtimeEventType {
  return (ADMIN_REALTIME_EVENT_TYPES as readonly string[]).includes(value);
}

export function isHighSignalRealtimeType(value: string): boolean {
  return (HIGH_SIGNAL_REALTIME_TYPES as readonly string[]).includes(value);
}
