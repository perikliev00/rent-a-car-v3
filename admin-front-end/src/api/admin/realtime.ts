/**
 * Admin SSE realtime contract: event type catalog, high-signal toast filter,
 * and stream URL helpers. Quiet types still drive cache invalidation in the hook.
 */
import { API_BASE, toVersionedApiPath } from '../client';

/** Domain events the admin EventSource listens for. */
export const ADMIN_REALTIME_EVENT_TYPES = [
  // Supply the literal value used by the enclosing expression.
  'new_booking',
  // Supply the literal value used by the enclosing expression.
  'payment_succeeded',
  // Supply the literal value used by the enclosing expression.
  'payment_failed',
  // Supply the literal value used by the enclosing expression.
  'reservation_confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_returned',
  // Supply the literal value used by the enclosing expression.
  'manual_review_needed',
  // Supply the literal value used by the enclosing expression.
  'paid_but_not_confirmed',
  // Supply the literal value used by the enclosing expression.
  'reservation_updated',
  // Supply the literal value used by the enclosing expression.
  'calendar_updated',
// Apply the TypeScript type assertion for this value.
] as const;

// Export the admin realtime event type type.
export type AdminRealtimeEventType = (typeof ADMIN_REALTIME_EVENT_TYPES)[number];

/** Toast only these — quiet types still invalidate caches. */
export const HIGH_SIGNAL_REALTIME_TYPES = [
  // Supply the literal value used by the enclosing expression.
  'new_booking',
  // Supply the literal value used by the enclosing expression.
  'payment_succeeded',
  // Supply the literal value used by the enclosing expression.
  'payment_failed',
  // Supply the literal value used by the enclosing expression.
  'reservation_confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_returned',
  // Supply the literal value used by the enclosing expression.
  'manual_review_needed',
  // Supply the literal value used by the enclosing expression.
  'paid_but_not_confirmed',
// Apply the TypeScript type assertion for this value.
] as const;

/** Payload shape for a single admin realtime SSE message. */
export type AdminRealtimeEvent = {
  // Provide the id field value.
  id: string;
  // Provide the type field value.
  type: AdminRealtimeEventType | string;
  // Provide the occurred at field value.
  occurredAt: string;
  // Provide the reservation id field value.
  reservationId: string | null;
  // Provide the order id field value.
  orderId: string | null;
  // Provide the car id field value.
  carId: string | null;
  // Provide the car name field value.
  carName: string | null;
  // Provide the customer name field value.
  customerName: string | null;
  // Provide the status field value.
  status: string | null;
  // Provide the old status field value.
  oldStatus: string | null;
  // Provide the message field value.
  message: string;
  // Provide the meta field value.
  meta: Record<string, unknown>;
};

/**
 * Cookie-authenticated SSE endpoint (versioned via the shared client helpers).
 */
export function getAdminRealtimeStreamUrl(): string {
  // Return the resulting value to the caller.
  return `${API_BASE}${toVersionedApiPath('/api/admin/realtime/stream')}`;
}

/**
 * Type guard: value is one of {@link ADMIN_REALTIME_EVENT_TYPES}.
 * @param value - Event type string from the SSE payload
 */
export function isAdminRealtimeEventType(value: string): value is AdminRealtimeEventType {
  // Return the resulting value to the caller.
  return (ADMIN_REALTIME_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Whether the event should show a toast (vs quiet cache-only handling).
 * @param value - Event type string from the SSE payload
 */
export function isHighSignalRealtimeType(value: string): boolean {
  // Return the resulting value to the caller.
  return (HIGH_SIGNAL_REALTIME_TYPES as readonly string[]).includes(value);
}
