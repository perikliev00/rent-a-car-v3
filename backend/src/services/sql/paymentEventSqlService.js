const { clientQuery } = require('../../db/transaction');

const REFUND_INBOX_EVENT_TYPES = [
  'charge.refunded',
  'refund.updated',
  'refund.created',
  'refund.failed',
];

const PAYMENT_EVENT_COLUMNS = `
  id,
  event_id,
  event_type,
  stripe_session_id,
  reservation_id,
  status,
  payload,
  created_at,
  updated_at
`;

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
    RETURNING ${PAYMENT_EVENT_COLUMNS}
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

async function findByEventId(eventId, client = null) {
  if (!eventId) return null;
  const result = await clientQuery(
    client,
    `
    SELECT ${PAYMENT_EVENT_COLUMNS}
    FROM payment_events
    WHERE event_id = $1
    LIMIT 1
    `,
    [eventId]
  );
  return result.rows[0] || null;
}

async function updatePaymentEventStatus(id, status, client = null) {
  const result = await clientQuery(
    client,
    `
    UPDATE payment_events
    SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING ${PAYMENT_EVENT_COLUMNS}
    `,
    [id, status]
  );
  return result.rows[0] || null;
}

async function listStuckReceivedRefundEvents(
  { olderThanMinutes = 5, limit = 50 } = {},
  client = null
) {
  const minutes = Math.max(0, Number(olderThanMinutes) || 0);
  const result = await clientQuery(
    client,
    `
    SELECT ${PAYMENT_EVENT_COLUMNS}
    FROM payment_events
    WHERE event_type = ANY($1::text[])
      AND status = 'received'
      AND payload IS NOT NULL
      AND created_at <= NOW() - ($2::int * INTERVAL '1 minute')
    ORDER BY created_at ASC
    LIMIT $3
    `,
    [REFUND_INBOX_EVENT_TYPES, minutes, limit]
  );
  return result.rows;
}

async function listRecentPaymentEvents({ limit = 50, offset = 0 } = {}, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT ${PAYMENT_EVENT_COLUMNS}
    FROM payment_events
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows;
}

module.exports = {
  REFUND_INBOX_EVENT_TYPES,
  insertPaymentEvent,
  findByEventId,
  updatePaymentEventStatus,
  listStuckReceivedRefundEvents,
  listRecentPaymentEvents,
};
