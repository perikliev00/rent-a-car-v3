/**
 * Idempotency store for processed Stripe webhook event ids.
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Record a processed Stripe event id. Returns false when the id was already seen
 * (ON CONFLICT DO NOTHING) so webhooks stay idempotent under retries.
 * @param {{eventId: string, stripeSessionId?: string|null}} fields
 * @param {object|null} [client]
 * @returns {Promise<boolean>} true if newly inserted
 */
async function insertProcessedEvent({ eventId, stripeSessionId }, client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!eventId) {
    // Throw an error to stop the current control flow.
    throw new Error('Stripe event id is required');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO processed_stripe_events (
      event_id,
      stripe_session_id,
      processed_at
    )
    VALUES ($1, $2, NOW())
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id
    `,
    // Contribute this line to the enclosing declaration or statement.
    [eventId, stripeSessionId || null]
  );

  // Return the resulting value to the caller.
  return result.rowCount > 0;
}

/** @param {string} eventId @param {object|null} [client] */
async function findProcessedEventByEventId(eventId, client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!eventId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, event_id, stripe_session_id, processed_at, created_at, updated_at
    FROM processed_stripe_events
    WHERE event_id = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [eventId]
  );

  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  insertProcessedEvent,
  // Contribute this line to the enclosing declaration or statement.
  findProcessedEventByEventId,
};
