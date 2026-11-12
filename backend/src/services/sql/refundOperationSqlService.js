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
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: row.id,
    // Provide the reservation id field value.
    reservationId: row.reservation_id,
    // Provide the order id field value.
    orderId: row.order_id,
    // Provide the stripe payment intent id field value.
    stripePaymentIntentId: row.stripe_payment_intent_id,
    // Provide the stripe refund id field value.
    stripeRefundId: row.stripe_refund_id,
    // Provide the amount cents field value.
    amountCents: row.amount_cents,
    // Provide the currency field value.
    currency: row.currency,
    // Provide the status field value.
    status: row.status,
    // Provide the idempotency key field value.
    idempotencyKey: row.idempotency_key,
    // Provide the requested by user id field value.
    requestedByUserId: row.requested_by_user_id,
    // Provide the failure code field value.
    failureCode: row.failure_code,
    // Provide the failure message field value.
    failureMessage: row.failure_message,
    // Provide the stripe raw status field value.
    stripeRawStatus: row.stripe_raw_status,
    // Provide the reason field value.
    reason: row.reason,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
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
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Update orderId with the right-hand side value.
    orderId = null,
    // Contribute this line to the enclosing declaration or statement.
    stripePaymentIntentId,
    // Update stripeRefundId with the right-hand side value.
    stripeRefundId = null,
    // Contribute this line to the enclosing declaration or statement.
    amountCents,
    // Update currency with the right-hand side value.
    currency = 'eur',
    // Update status with the right-hand side value.
    status = 'pending',
    // Contribute this line to the enclosing declaration or statement.
    idempotencyKey,
    // Update requestedByUserId with the right-hand side value.
    requestedByUserId = null,
    // Update stripeRawStatus with the right-hand side value.
    stripeRawStatus = null,
    // Update reason with the right-hand side value.
    reason = null,
  },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Contribute this line to the enclosing declaration or statement.
      orderId,
      // Contribute this line to the enclosing declaration or statement.
      stripePaymentIntentId,
      // Contribute this line to the enclosing declaration or statement.
      stripeRefundId,
      // Contribute this line to the enclosing declaration or statement.
      amountCents,
      // Contribute this line to the enclosing declaration or statement.
      currency,
      // Contribute this line to the enclosing declaration or statement.
      status,
      // Contribute this line to the enclosing declaration or statement.
      idempotencyKey,
      // Contribute this line to the enclosing declaration or statement.
      requestedByUserId,
      // Contribute this line to the enclosing declaration or statement.
      stripeRawStatus,
      // Contribute this line to the enclosing declaration or statement.
      reason,
    ]
  );
  // Return the resulting value to the caller.
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
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `SELECT * FROM refund_operations WHERE id = $1 LIMIT 1`,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Return the resulting value to the caller.
  return mapRow(result.rows[0]);
}

/**
 * Find by idempotency key via SQL; returns null when missing.
 * @param {string} idempotencyKey
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByIdempotencyKey(idempotencyKey, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `SELECT * FROM refund_operations WHERE idempotency_key = $1 LIMIT 1`,
    // Contribute this line to the enclosing declaration or statement.
    [idempotencyKey]
  );
  // Return the resulting value to the caller.
  return mapRow(result.rows[0]);
}

/**
 * Find active by reservation id via SQL; returns null when missing.
 * @param {string|number} reservationId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findActiveByReservationId(reservationId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT * FROM refund_operations
    WHERE reservation_id = $1
      AND status IN ('pending', 'succeeded')
    ORDER BY id DESC
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
  // Return the resulting value to the caller.
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
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `SELECT * FROM refund_operations WHERE stripe_refund_id = $1 LIMIT 1`,
    // Contribute this line to the enclosing declaration or statement.
    [stripeRefundId]
  );
  // Return the resulting value to the caller.
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
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT * FROM refund_operations
    WHERE stripe_payment_intent_id = $1
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'succeeded' THEN 1 ELSE 2 END,
      id DESC
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [paymentIntentId]
  );
  // Return the resulting value to the caller.
  return mapRow(result.rows[0]);
}

/**
 * Find latest by reservation id via SQL; returns null when missing.
 * @param {string|number} reservationId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findLatestByReservationId(reservationId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT * FROM refund_operations
    WHERE reservation_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );
  // Return the resulting value to the caller.
  return mapRow(result.rows[0]);
}

/**
 * Failed ops that already have a Stripe refund id — reconcile may mark them succeeded.
 * @param {{ olderThanMinutes?: number, limit?: number }} [params]
 * @param {object|null} [client]
 * @returns {Promise<object[]>}
 */
async function findFailedWithRefundIdOlderThan(
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
    SELECT * FROM refund_operations
    WHERE status = 'failed'
      AND stripe_refund_id IS NOT NULL
      AND updated_at <= NOW() - ($1::int * INTERVAL '1 minute')
    ORDER BY updated_at ASC
    LIMIT $2
    `,
    // Contribute this line to the enclosing declaration or statement.
    [minutes, limit]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapRow);
}

/**
 * Find pending older than via SQL; returns null when missing.
 * @param {object} params
 * @param {object|null} [client] Optional DB client/transaction
 * @returns {Promise<*>}
 */
async function findPendingOlderThan({ olderThanMinutes = 5, limit = 50 } = {}, client = null) {
  // Create the minutes constant.
  const minutes = Math.max(0, Number(olderThanMinutes) || 0);
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT * FROM refund_operations
    WHERE status = 'pending'
      AND created_at <= NOW() - ($1::int * INTERVAL '1 minute')
    ORDER BY created_at ASC
    LIMIT $2
    `,
    // Contribute this line to the enclosing declaration or statement.
    [minutes, limit]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapRow);
}

// Create the regressing raw statuses constant.
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
    // Return the resulting value to the caller.
    return true;
  }
  // Status / lifecycle guard before mutating domain state.
  if (has('stripeRawStatus') && REGRESSING_RAW_STATUSES.has(String(patch.stripeRawStatus))) {
    // Return the resulting value to the caller.
    return true;
  }
  // Return the resulting value to the caller.
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
  // Create the has constant.
  const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
  // Create the guard succeeded constant.
  const guardSucceeded = shouldGuardSucceeded(patch, has);
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Call has to perform this step.
      has('stripeRefundId'),
      // Call has to perform this step.
      has('stripeRefundId') ? patch.stripeRefundId : null,
      // Call has to perform this step.
      has('status'),
      // Call has to perform this step.
      has('status') ? patch.status : null,
      // Call has to perform this step.
      has('failureCode'),
      // Call has to perform this step.
      has('failureCode') ? patch.failureCode : null,
      // Call has to perform this step.
      has('failureMessage'),
      // Call has to perform this step.
      has('failureMessage') ? patch.failureMessage : null,
      // Call has to perform this step.
      has('stripeRawStatus'),
      // Call has to perform this step.
      has('stripeRawStatus') ? patch.stripeRawStatus : null,
      // Call has to perform this step.
      has('orderId'),
      // Call has to perform this step.
      has('orderId') ? patch.orderId : null,
    ]
  );
  // Return the resulting value to the caller.
  return mapRow(result.rows[0]);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  insertRefundOperation,
  // Contribute this line to the enclosing declaration or statement.
  findById,
  // Contribute this line to the enclosing declaration or statement.
  findByIdempotencyKey,
  // Contribute this line to the enclosing declaration or statement.
  findActiveByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  findByStripeRefundId,
  // Contribute this line to the enclosing declaration or statement.
  findByPaymentIntentId,
  // Contribute this line to the enclosing declaration or statement.
  findLatestByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  findFailedWithRefundIdOlderThan,
  // Contribute this line to the enclosing declaration or statement.
  findPendingOlderThan,
  // Contribute this line to the enclosing declaration or statement.
  updateRefundOperation,
  // Contribute this line to the enclosing declaration or statement.
  mapRow,
};
