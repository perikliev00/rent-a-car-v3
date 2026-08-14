const { clientQuery } = require('../../db/transaction');

function mapRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    type: row.type,
    channel: row.channel,
    recipientEmail: row.recipient_email,
    recipientUserId: row.recipient_user_id != null ? String(row.recipient_user_id) : null,
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    orderId: row.order_id != null ? String(row.order_id) : null,
    carId: row.car_id != null ? String(row.car_id) : null,
    payload: row.payload || {},
    status: row.status,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    attempts: Number(row.attempts || 0),
    lastError: row.last_error || null,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Insert pending notification. Returns row if inserted, null if idempotency conflict.
 */
async function insertNotification(data, client = null) {
  const result = await clientQuery(
    client,
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
      data.type,
      data.channel || 'email',
      data.recipientEmail || null,
      data.recipientUserId || null,
      data.reservationId || null,
      data.orderId || null,
      data.carId || null,
      JSON.stringify(data.payload || {}),
      data.status || 'pending',
      data.scheduledAt || null,
      data.idempotencyKey,
    ]
  );
  return mapRow(result.rows[0]);
}

async function claimDueNotifications({ limit = 50 } = {}, client = null) {
  const result = await clientQuery(
    client,
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
    [limit]
  );
  return result.rows.map(mapRow);
}

async function markSent(id, client = null) {
  await clientQuery(
    client,
    `
    UPDATE notifications
    SET status = 'sent', sent_at = NOW(), last_error = NULL, updated_at = NOW()
    WHERE id = $1
    `,
    [id]
  );
}

async function markFailed(id, errorMessage, client = null) {
  await clientQuery(
    client,
    `
    UPDATE notifications
    SET status = 'failed', last_error = $2, updated_at = NOW()
    WHERE id = $1
    `,
    [id, String(errorMessage || 'unknown error').slice(0, 2000)]
  );
}

async function requeuePending(id, client = null) {
  await clientQuery(
    client,
    `
    UPDATE notifications
    SET status = 'pending', updated_at = NOW()
    WHERE id = $1 AND status = 'processing'
    `,
    [id]
  );
}

async function listNotifications({ limit = 50, offset = 0, status = null } = {}, client = null) {
  const params = [];
  const where = [];
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const result = await clientQuery(
    client,
    `
    SELECT *
    FROM notifications
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    params
  );
  return result.rows.map(mapRow);
}

async function countNotifications({ status = null } = {}, client = null) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE status = $1`;
  }
  const result = await clientQuery(
    client,
    `SELECT COUNT(*)::int AS count FROM notifications ${where}`,
    params
  );
  return result.rows[0]?.count || 0;
}

module.exports = {
  insertNotification,
  claimDueNotifications,
  markSent,
  markFailed,
  requeuePending,
  listNotifications,
  countNotifications,
  mapRow,
};
