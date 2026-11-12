/**
 * Helpers to deep-link from calendar events into reservation ops.
 * Event ids are prefixed by kind (`reservation:…`, `pickup:…`, etc.).
 */

/**
 * Extract reservation id from calendar event id or reservationId field.
 * Prefers the explicit `reservationId` when present; otherwise parses prefixed ids.
 *
 * @param ev - Calendar event-like object
 */
export function reservationIdFromEvent(ev: {
  id: string;
  reservationId?: string | null;
  type?: string;
}): string | null {
  if (ev.reservationId) return String(ev.reservationId);
  // Composite ids: `reservation:123`, `pickup:123`, etc.
  const m = String(ev.id).match(
    /^(?:reservation|pickup|return|manual_review|payment_issue):(.+)$/
  );
  return m ? m[1] : null;
}

/**
 * Ops page URL that opens a specific reservation via `?id=`.
 * @param reservationId - Reservation id to highlight
 */
export function opsReservationUrl(reservationId: string): string {
  return `/admin/reservations?id=${encodeURIComponent(reservationId)}`;
}
