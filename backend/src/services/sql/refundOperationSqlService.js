/**
 * SQL for refund_operations tracking Stripe refund attempts/status.
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapRow).
 * @param {object} row
 * @returns {*}
 */
function mapRow(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  return {
    id: row.id,
    reservationId: row.reservation_id,
    orderId: row.order_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeRefundId: row.stripe_refund_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    requestedByUserId: row.requested_by_user_id,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    stripeRawStatus: row.stripe_raw_status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Insert a refund_operations row (idempotency_key unique for safe retries).
 * @param {object} params
 * @param {object|null} [client]
 * @returns {Promise<object>}
 */
async function insertRefundOperation(
  {
    reservationId,
    orderId = null,
    stripePaymentIntentId,
    stripeRefundId = null,
    amountCents,
    currency = 'eur',
    status = 'pending',
    idempotencyKey,
    requestedByUserId = null,
    stripeRawStatus = null,
    reason = null,
  },
  client = null
) {
  const result = await clientQuery(
    client,
    `
    INSERT INTO refund_operations (
      reservation_id,
      order_id,
      stripe_payment_intent_id,
      stripe_refund_id,
      amount_cents,
      currency,
      status,
      idempotency_key,
      requested_by_user_id,
      stripe_raw_status,
      reason
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
    `,
    [
      reservationId,
      orderId,
      stripePaymentIntentId,
      stripeRefundId,
      amountCents,
      currency,
      status,
      idempotencyKey,
      requestedByUserId,
      stripeRawStatus,
      reason,
    ]
  );
  return mapRow(result.rows[0]);
}

/**
 * Find by id via SQL; returns null when missing.
 * @param {string|number} id
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findById(id, client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (id == null) return null;
  const result = await clientQuery(
    client,
    `SELECT * FROM refund_operations WHERE id = $1 LIMIT 1`,
    [id]
  );
  return mapRow(result.rows[0]);
}

/**
 * Find by idempotency key via SQL; returns null when missing.
 * @param {string} idempotencyKey
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByIdempotencyKey(idempotencyKey, client = null) {
  const result = await clientQuery(
    client,
    `SELECT * FROM refund_operations WHERE idempotency_key = $1 LIMIT 1`,
    [idempotencyKey]
  );
  return mapRow(result.rows[0]);
}

/**
 * Find active by reservation id via SQL; returns null when missing.
 * @param {string|number} reservationId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findActiveByReservationId(reservationId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT * FROM refund_operations
    WHERE reservation_id = $1
      AND status IN ('pending', 'succeeded')
    ORDER BY id DESC
    LIMIT 1
    `,
    [reservationId]
  );
  return mapRow(result.rows[0]);
}

/**
 * Find by stripe refund id via SQL; returns null when missing.
 * @param {string|number} stripeRefundId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByStripeRefundId(stripeRefundId, client = null) {
  // Stripe / payment-related branch.
  if (!stripeRefundId) return null;
  const result = await clientQuery(
    client,
    `SELECT * FROM refund_operations WHERE stripe_refund_id = $1 LIMIT 1`,
    [stripeRefundId]
  );
  return mapRow(result.rows[0]);
}

/**
 * Find by payment intent id via SQL; returns null when missing.
 * @param {string|number} paymentIntentId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByPaymentIntentId(paymentIntentId, client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!paymentIntentId) return null;
  const result = await clientQuery(
    client,
    `
    SELECT * FROM refund_operations
    WHERE stripe_payment_intent_id = $1
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'succeeded' THEN 1 ELSE 2 END,
      id DESC
    LIMIT 1
    `,
    [paymentIntentId]
  );
  return mapRow(result.rows[0]);
}

/**
 * Find latest by reservation id via SQL; returns null when missing.
 * @param {string|number} reservationId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findLatestByReservationId(reservationId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT * FROM refund_operations
    WHERE reservation_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [reservationId]
  );
  return mapRow(result.rows[0]);
}

/**
 * Failed ops that already have a Stripe refund id — reconcile may mark them succeeded.
 * @param {{ olderThanMinutes?: number, limit?: number }} [params]
 * @param {object|null} [client]
 * @returns {Promise<object[]>}
 */
async function findFailedWithRefundIdOlderThan(
  { olderThanMinutes = 5, limit = 50 } = {},
  client = null
) {
  const minutes = Math.max(0, Number(olderThanMinutes) || 0);
  const result = await clientQuery(
    client,
    `
    SELECT * FROM refund_operations
    WHERE status = 'failed'
      AND stripe_refund_id IS NOT NULL
      AND updated_at <= NOW() - ($1::int * INTERVAL '1 minute')
    ORDER BY updated_at ASC
    LIMIT $2
    `,
    [minutes, limit]
  );
  return result.rows.map(mapRow);
}

/**
 * Find pending older than via SQL; returns null when missing.
 * @param {object} params
 * @param {object|null} [client] Optional DB client/transaction
 * @returns {Promise<*>}
 */
async function findPendingOlderThan({ olderThanMinutes = 5, limit = 50 } = {}, client = null) {
  const minutes = Math.max(0, Number(olderThanMinutes) || 0);
  const result = await clientQuery(
    client,
    `
    SELECT * FROM refund_operations
    WHERE status = 'pending'
      AND created_at <= NOW() - ($1::int * INTERVAL '1 minute')
    ORDER BY created_at ASC
    LIMIT $2
    `,
    [minutes, limit]
  );
  return result.rows.map(mapRow);
}

const REGRESSING_RAW_STATUSES = new Set(['pending', 'failed', 'canceled']);

/**
 * should guard succeeded.
 * @param {object} patch
 * @param {boolean} has
 * @returns {*}
 */
function shouldGuardSucceeded(patch, has) {
  // Status / lifecycle guard before mutating domain state.
  if (has('status') && (patch.status === 'pending' || patch.status === 'failed')) {
    return true;
  }
  // Status / lifecycle guard before mutating domain state.
  if (has('stripeRawStatus') && REGRESSING_RAW_STATUSES.has(String(patch.stripeRawStatus))) {
    return true;
  }
  return false;
}

/**
 * Update or upsert refund operation; returns null when not found.
 * @param {string|number} id
 * @param {object} patch
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function updateRefundOperation(id, patch, client = null) {
  const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
  const guardSucceeded = shouldGuardSucceeded(patch, has);
  const result = await clientQuery(
    client,
    `
    UPDATE refund_operations
    SET
      stripe_refund_id = CASE WHEN $2::boolean THEN $3 ELSE stripe_refund_id END,
      status = CASE WHEN $4::boolean THEN $5 ELSE status END,
      failure_code = CASE WHEN $6::boolean THEN $7 ELSE failure_code END,
      failure_message = CASE WHEN $8::boolean THEN $9 ELSE failure_message END,
      stripe_raw_status = CASE WHEN $10::boolean THEN $11 ELSE stripe_raw_status END,
      order_id = CASE WHEN $12::boolean THEN $13 ELSE order_id END,
      updated_at = NOW()
    WHERE id = $1
      ${guardSucceeded ? "AND status <> 'succeeded'" : ''}
    RETURNING *
    `,
    [
      id,
      has('stripeRefundId'),
      has('stripeRefundId') ? patch.stripeRefundId : null,
      has('status'),
      has('status') ? patch.status : null,
      has('failureCode'),
      has('failureCode') ? patch.failureCode : null,
      has('failureMessage'),
      has('failureMessage') ? patch.failureMessage : null,
      has('stripeRawStatus'),
      has('stripeRawStatus') ? patch.stripeRawStatus : null,
      has('orderId'),
      has('orderId') ? patch.orderId : null,
    ]
  );
  return mapRow(result.rows[0]);
}

module.exports = {
  insertRefundOperation,
  findById,
  findByIdempotencyKey,
  findActiveByReservationId,
  findByStripeRefundId,
  findByPaymentIntentId,
  findLatestByReservationId,
  findFailedWithRefundIdOlderThan,
  findPendingOlderThan,
  updateRefundOperation,
  mapRow,
};
