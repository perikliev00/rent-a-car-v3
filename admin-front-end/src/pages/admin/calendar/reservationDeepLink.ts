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
  // Provide the id field value.
  id: string;
  // Contribute this line to the enclosing declaration or statement.
  reservationId?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  type?: string;
// Continue the surrounding logic with this statement.
}): string | null {
  // Evaluate the condition and enter the branch when it is true.
  if (ev.reservationId) return String(ev.reservationId);
  // Composite ids: `reservation:123`, `pickup:123`, etc.
  const m = String(ev.id).match(
    // Continue the surrounding logic with this statement.
    /^(?:reservation|pickup|return|manual_review|payment_issue):(.+)$/
  );
  // Return the resulting value to the caller.
  return m ? m[1] : null;
}

/**
 * Ops page URL that opens a specific reservation via `?id=`.
 * @param reservationId - Reservation id to highlight
 */
export function opsReservationUrl(reservationId: string): string {
  // Return the resulting value to the caller.
  return `/admin/reservations?id=${encodeURIComponent(reservationId)}`;
}
