const { clientQuery } = require('../../db/transaction');

function normalizeReservationId(value) {
  if (value == null || value === '') {
    return null;
  }
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function insertPaymentEvent(
  { eventId, eventType, stripeSessionId, reservationId, status = 'received', payload = null },
  client = null
) {
  if (!eventType) {
    throw new Error('Payment event type is required');
  }

  const result = await clientQuery(
    client,
    `
    INSERT INTO payment_events (
      event_id,
      event_type,
      stripe_session_id,
      reservation_id,
      status,
      payload
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, event_id, event_type, stripe_session_id, reservation_id, status, created_at
    `,
    [
      eventId || null,
      eventType,
      stripeSessionId || null,
      normalizeReservationId(reservationId),
      status,
      payload ? JSON.stringify(payload) : null,
    ]
  );

  return result.rows[0] || null;
}

async function listRecentPaymentEvents({ limit = 50, offset = 0 } = {}, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      id,
      event_id,
      event_type,
      stripe_session_id,
      reservation_id,
      status,
      payload,
      created_at
    FROM payment_events
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows;
}

module.exports = {
  insertPaymentEvent,
  listRecentPaymentEvents,
};
