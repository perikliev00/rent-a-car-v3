/**
 * Persistence for the notifications outbox table.
 *
 * claimDueNotifications uses FOR UPDATE SKIP LOCKED so multiple workers can
 * process safely. Inserts are idempotent via unique idempotency_key.
 */

const { clientQuery } = require('../../db/transaction');

/** Map DB row to camelCase DTO. */
function mapRow(row) {
  // Evaluate the condition and enter the branch when it is true.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the type field value.
    type: row.type,
    // Provide the channel field value.
    channel: row.channel,
    // Provide the recipient email field value.
    recipientEmail: row.recipient_email,
    // Provide the recipient user id field value.
    recipientUserId: row.recipient_user_id != null ? String(row.recipient_user_id) : null,
    // Provide the reservation id field value.
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    // Provide the order id field value.
    orderId: row.order_id != null ? String(row.order_id) : null,
    // Provide the car id field value.
    carId: row.car_id != null ? String(row.car_id) : null,
    // Provide the payload field value.
    payload: row.payload || {},
    // Provide the status field value.
    status: row.status,
    // Provide the scheduled at field value.
    scheduledAt: row.scheduled_at,
    // Provide the sent at field value.
    sentAt: row.sent_at,
    // Provide the attempts field value.
    attempts: Number(row.attempts || 0),
    // Provide the last error field value.
    lastError: row.last_error || null,
    // Provide the idempotency key field value.
    idempotencyKey: row.idempotency_key,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
  };
}

/**
 * Insert pending notification. Returns row if inserted, null if idempotency conflict.
 */
async function insertNotification(data, client = null) {
  // ON CONFLICT DO NOTHING + RETURNING → null when the key already exists.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO notifications (
      type, channel, recipient_email, recipient_user_id,
      reservation_id, order_id, car_id, payload,
      status, scheduled_at, idempotency_key
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8::jsonb,
      COALESCE($9, 'pending'), COALESCE($10, NOW()), $11
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING *
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      data.type,
      // Contribute this line to the enclosing declaration or statement.
      data.channel || 'email',
      // Contribute this line to the enclosing declaration or statement.
      data.recipientEmail || null,
      // Contribute this line to the enclosing declaration or statement.
      data.recipientUserId || null,
      // Contribute this line to the enclosing declaration or statement.
      data.reservationId || null,
      // Contribute this line to the enclosing declaration or statement.
      data.orderId || null,
      // Contribute this line to the enclosing declaration or statement.
      data.carId || null,
      // Call JSON.stringify to perform this step.
      JSON.stringify(data.payload || {}),
      // Contribute this line to the enclosing declaration or statement.
      data.status || 'pending',
      // Contribute this line to the enclosing declaration or statement.
      data.scheduledAt || null,
      // Contribute this line to the enclosing declaration or statement.
      data.idempotencyKey,
    ]
  );
  // Return the resulting value to the caller.
  return mapRow(result.rows[0]);
}

/**
 * Atomically claim due pending rows as processing (requires a transaction).
 * @param {{ limit?: number }} [opts]
 */
async function claimDueNotifications({ limit = 50 } = {}, client = null) {
  // CTE selects due pending rows under SKIP LOCKED, then flips them to processing.
  // Must run inside a transaction so the lock is held until commit.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    WITH due AS (
      SELECT id
      FROM notifications
      WHERE status = 'pending'
        AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE notifications n
    SET status = 'processing',
        attempts = n.attempts + 1,
        updated_at = NOW()
    FROM due
    WHERE n.id = due.id
    RETURNING n.*
    `,
    // Contribute this line to the enclosing declaration or statement.
    [limit]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapRow);
}

/** Mark notification successfully delivered. */
async function markSent(id, client = null) {
  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE notifications
    SET status = 'sent', sent_at = NOW(), last_error = NULL, updated_at = NOW()
    WHERE id = $1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
}

/** Mark notification failed and store truncated error text. */
async function markFailed(id, errorMessage, client = null) {
  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE notifications
    SET status = 'failed', last_error = $2, updated_at = NOW()
    WHERE id = $1
    `,
    // Continue the surrounding logic with this statement.
    [id, String(errorMessage || 'unknown error').slice(0, 2000)]
  );
}

/** Return a stuck processing row to pending for retry. */
async function requeuePending(id, client = null) {
  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE notifications
    SET status = 'pending', updated_at = NOW()
    WHERE id = $1 AND status = 'processing'
    `,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
}

/** Admin list, newest first. */
async function listNotifications({ limit = 50, offset = 0, status = null } = {}, client = null) {
  // Create the params constant.
  const params = [];
  // Create the where constant.
  const where = [];
  // Evaluate the condition and enter the branch when it is true.
  if (status) {
    // Call params.push to perform this step.
    params.push(status);
    // Call where.push to perform this step.
    where.push(`status = $${params.length}`);
  }
  // Call params.push to perform this step.
  params.push(limit);
  // Create the limit idx constant.
  const limitIdx = params.length;
  // Call params.push to perform this step.
  params.push(offset);
  // Create the offset idx constant.
  const offsetIdx = params.length;

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT *
    FROM notifications
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapRow);
}

/** Count for pagination. */
async function countNotifications({ status = null } = {}, client = null) {
  // Create the params constant.
  const params = [];
  // Initialize the mutable where variable.
  let where = '';
  // Evaluate the condition and enter the branch when it is true.
  if (status) {
    // Call params.push to perform this step.
    params.push(status);
    // Update where with the right-hand side value.
    where = `WHERE status = $1`;
  }
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `SELECT COUNT(*)::int AS count FROM notifications ${where}`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Return the resulting value to the caller.
  return result.rows[0]?.count || 0;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  insertNotification,
  // Contribute this line to the enclosing declaration or statement.
  claimDueNotifications,
  // Contribute this line to the enclosing declaration or statement.
  markSent,
  // Contribute this line to the enclosing declaration or statement.
  markFailed,
  // Contribute this line to the enclosing declaration or statement.
  requeuePending,
  // Contribute this line to the enclosing declaration or statement.
  listNotifications,
  // Contribute this line to the enclosing declaration or statement.
  countNotifications,
  // Contribute this line to the enclosing declaration or statement.
  mapRow,
};
