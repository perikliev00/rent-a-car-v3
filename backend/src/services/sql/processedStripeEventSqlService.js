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
    throw new Error('Stripe event id is required');
  }

  const result = await clientQuery(
    client,
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
    [eventId, stripeSessionId || null]
  );

  return result.rowCount > 0;
}

/** @param {string} eventId @param {object|null} [client] */
async function findProcessedEventByEventId(eventId, client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!eventId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT id, event_id, stripe_session_id, processed_at, created_at, updated_at
    FROM processed_stripe_events
    WHERE event_id = $1
    LIMIT 1
    `,
    [eventId]
  );

  return result.rows[0] || null;
}

module.exports = {
  insertProcessedEvent,
  findProcessedEventByEventId,
};
