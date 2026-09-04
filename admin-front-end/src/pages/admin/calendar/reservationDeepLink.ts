/** Extract reservation id from calendar event id or reservationId field. */
export function reservationIdFromEvent(ev: {
  id: string;
  reservationId?: string | null;
  type?: string;
}): string | null {
  if (ev.reservationId) return String(ev.reservationId);
  const m = String(ev.id).match(
    /^(?:reservation|pickup|return|manual_review|payment_issue):(.+)$/
  );
  return m ? m[1] : null;
}

export function opsReservationUrl(reservationId: string): string {
  return `/admin/reservations?id=${encodeURIComponent(reservationId)}`;
}
