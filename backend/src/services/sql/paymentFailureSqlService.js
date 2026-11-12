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
    // Return the resulting value to the caller.
    return null;
  }
  // Create the id constant.
  const id = Number(value);
  // Return the resulting value to the caller.
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
  // Continue the surrounding logic with this statement.
  { reason, correlationId, stripeSessionId, reservationId, eventId, context = null },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Evaluate the condition and enter the branch when it is true.
  if (!reason) {
    // Throw an error to stop the current control flow.
    throw new Error('Payment failure reason is required');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      reason,
      // Contribute this line to the enclosing declaration or statement.
      correlationId || null,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId || null,
      // Call normalizeReservationId to perform this step.
      normalizeReservationId(reservationId),
      // Contribute this line to the enclosing declaration or statement.
      eventId || null,
      // Continue the surrounding logic with this statement.
      context ? JSON.stringify(context) : null,
    ]
  );

  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

/**
 * List payment failures from SQL.
 * @param {object} params
 * @param {object|null} [client] Optional DB client/transaction
 * @returns {Promise<*>}
 */
async function listPaymentFailures({ limit = 50, offset = 0, unresolvedOnly = false } = {}, client = null) {
  // Create the params constant.
  const params = [limit, offset];
  // Initialize the mutable where clause variable.
  let whereClause = '';

  // Evaluate the condition and enter the branch when it is true.
  if (unresolvedOnly) {
    // Update whereClause with the right-hand side value.
    whereClause = 'WHERE resolved = FALSE';
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Reference the identifier used by the enclosing expression.
    params
  );

  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return 0;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE payment_failures
    SET resolved = TRUE,
        resolved_at = NOW()
    WHERE stripe_session_id = $1
      AND resolved = FALSE
    `,
    // Contribute this line to the enclosing declaration or statement.
    [stripeSessionId]
  );

  // Return the resulting value to the caller.
  return result.rowCount || 0;
}

/**
 * count unresolved payment failures.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function countUnresolvedPaymentFailures(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT COUNT(*)::int AS count
    FROM payment_failures
    WHERE resolved = FALSE
    `
  );

  // Return the resulting value to the caller.
  return result.rows[0]?.count || 0;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  insertPaymentFailure,
  // Contribute this line to the enclosing declaration or statement.
  listPaymentFailures,
  // Contribute this line to the enclosing declaration or statement.
  markFailuresResolvedByStripeSession,
  // Contribute this line to the enclosing declaration or statement.
  countUnresolvedPaymentFailures,
};
