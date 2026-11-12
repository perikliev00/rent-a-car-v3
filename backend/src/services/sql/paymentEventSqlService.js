/**
 * SQL for payment_events monitoring feed (recent Stripe/payment activity).
 */
const { clientQuery } = require('../../db/transaction');

// Create the refund inbox event types constant.
const REFUND_INBOX_EVENT_TYPES = [
  // Supply the literal value used by the enclosing expression.
  'charge.refunded',
  // Supply the literal value used by the enclosing expression.
  'refund.updated',
  // Supply the literal value used by the enclosing expression.
  'refund.created',
  // Supply the literal value used by the enclosing expression.
  'refund.failed',
];

// Create the payment event columns constant.
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

/**
 * Normalize reservation id before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeReservationId(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (value == null || value === '') {
    // Return the resulting value to the caller.
    return null;
  }
  // Create the id constant.
  const id = Number(value);
  // Return the resulting value to the caller.
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Insert a payment_events inbox row (webhook/reconcile processing).
 * @param {object} params
 * @param {object|null} [client]
 * @returns {Promise<object|null>}
 * @throws {Error} when eventType is missing
 */
async function insertPaymentEvent(
  // Continue the surrounding logic with this statement.
  { eventId, eventType, stripeSessionId, reservationId, status = 'received', payload = null },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Evaluate the condition and enter the branch when it is true.
  if (!eventType) {
    // Throw an error to stop the current control flow.
    throw new Error('Payment event type is required');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      eventId || null,
      // Contribute this line to the enclosing declaration or statement.
      eventType,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId || null,
      // Call normalizeReservationId to perform this step.
      normalizeReservationId(reservationId),
      // Contribute this line to the enclosing declaration or statement.
      status,
      // Continue the surrounding logic with this statement.
      payload ? JSON.stringify(payload) : null,
    ]
  );

  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

/**
 * Find by event id via SQL; returns null when missing.
 * @param {string|number} eventId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByEventId(eventId, client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!eventId) return null;
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${PAYMENT_EVENT_COLUMNS}
    FROM payment_events
    WHERE event_id = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [eventId]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

/**
 * Update or upsert payment event status; returns null when not found.
 * @param {string|number} id
 * @param {string} status
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function updatePaymentEventStatus(id, status, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE payment_events
    SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING ${PAYMENT_EVENT_COLUMNS}
    `,
    // Contribute this line to the enclosing declaration or statement.
    [id, status]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

/**
 * Refund webhook events stuck in 'received' longer than the threshold (reconcile sweep).
 * @param {{ olderThanMinutes?: number, limit?: number }} [params]
 * @param {object|null} [client]
 * @returns {Promise<object[]>}
 */
async function listStuckReceivedRefundEvents(
  // Continue the surrounding logic with this statement.
  { olderThanMinutes = 5, limit = 50 } = {},
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the minutes constant.
  const minutes = Math.max(0, Number(olderThanMinutes) || 0);
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [REFUND_INBOX_EVENT_TYPES, minutes, limit]
  );
  // Return the resulting value to the caller.
  return result.rows;
}

/**
 * List recent payment events from SQL.
 * @param {object} params
 * @param {object|null} [client] Optional DB client/transaction
 * @returns {Promise<*>}
 */
async function listRecentPaymentEvents({ limit = 50, offset = 0 } = {}, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${PAYMENT_EVENT_COLUMNS}
    FROM payment_events
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
    `,
    // Contribute this line to the enclosing declaration or statement.
    [limit, offset]
  );

  // Return the resulting value to the caller.
  return result.rows;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  REFUND_INBOX_EVENT_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  insertPaymentEvent,
  // Contribute this line to the enclosing declaration or statement.
  findByEventId,
  // Contribute this line to the enclosing declaration or statement.
  updatePaymentEventStatus,
  // Contribute this line to the enclosing declaration or statement.
  listStuckReceivedRefundEvents,
  // Contribute this line to the enclosing declaration or statement.
  listRecentPaymentEvents,
};
