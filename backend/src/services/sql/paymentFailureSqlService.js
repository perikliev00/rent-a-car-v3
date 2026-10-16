/**
 * SQL for payment_failures (list unresolved + counts for admin monitoring).
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Normalize reservation id before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeReservationId(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (value == null || value === '') {
    return null;
  }
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Record a payment failure for ops dashboards (reason required).
 * @param {object} params
 * @param {object|null} [client]
 * @returns {Promise<object|null>}
 * @throws {Error} when reason is missing
 */
async function insertPaymentFailure(
  { reason, correlationId, stripeSessionId, reservationId, eventId, context = null },
  client = null
) {
  if (!reason) {
    throw new Error('Payment failure reason is required');
  }

  const result = await clientQuery(
    client,
    `
    INSERT INTO payment_failures (
      reason,
      correlation_id,
      stripe_session_id,
      reservation_id,
      event_id,
      context
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, reason, stripe_session_id, reservation_id, resolved, created_at
    `,
    [
      reason,
      correlationId || null,
      stripeSessionId || null,
      normalizeReservationId(reservationId),
      eventId || null,
      context ? JSON.stringify(context) : null,
    ]
  );

  return result.rows[0] || null;
}

/**
 * List payment failures from SQL.
 * @param {object} params
 * @param {object|null} [client] Optional DB client/transaction
 * @returns {Promise<*>}
 */
async function listPaymentFailures({ limit = 50, offset = 0, unresolvedOnly = false } = {}, client = null) {
  const params = [limit, offset];
  let whereClause = '';

  if (unresolvedOnly) {
    whereClause = 'WHERE resolved = FALSE';
  }

  const result = await clientQuery(
    client,
    `
    SELECT
      id,
      reason,
      correlation_id,
      stripe_session_id,
      reservation_id,
      event_id,
      context,
      resolved,
      resolved_at,
      created_at
    FROM payment_failures
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
    `,
    params
  );

  return result.rows;
}

/**
 * mark failures resolved by stripe session — mutates persisted state when applicable.
 * @param {string|number} stripeSessionId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function markFailuresResolvedByStripeSession(stripeSessionId, client = null) {
  // Stripe / payment-related branch.
  if (!stripeSessionId) {
    return 0;
  }

  const result = await clientQuery(
    client,
    `
    UPDATE payment_failures
    SET resolved = TRUE,
        resolved_at = NOW()
    WHERE stripe_session_id = $1
      AND resolved = FALSE
    `,
    [stripeSessionId]
  );

  return result.rowCount || 0;
}

/**
 * count unresolved payment failures.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function countUnresolvedPaymentFailures(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT COUNT(*)::int AS count
    FROM payment_failures
    WHERE resolved = FALSE
    `
  );

  return result.rows[0]?.count || 0;
}

module.exports = {
  insertPaymentFailure,
  listPaymentFailures,
  markFailuresResolvedByStripeSession,
  countUnresolvedPaymentFailures,
};
