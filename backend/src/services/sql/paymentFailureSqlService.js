const { clientQuery } = require('../../db/transaction');

function normalizeReservationId(value) {
  if (value == null || value === '') {
    return null;
  }
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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

async function markFailuresResolvedByStripeSession(stripeSessionId, client = null) {
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
