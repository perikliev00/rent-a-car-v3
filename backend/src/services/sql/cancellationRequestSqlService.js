const { clientQuery } = require('../../db/transaction');

function mapRequest(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    reservationId: String(row.reservation_id),
    userId: String(row.user_id),
    reason: row.reason || null,
    status: row.status,
    adminNote: row.admin_note || null,
    reviewedByUserId:
      row.reviewed_by_user_id != null ? Number(row.reviewed_by_user_id) : null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reservationStatus: row.reservation_status || undefined,
    customerEmail: row.customer_email || undefined,
    customerName: row.customer_name || undefined,
  };
}

async function create({ reservationId, userId, reason }, client = null) {
  const result = await clientQuery(
    client,
    `
    INSERT INTO reservation_cancellation_requests (
      reservation_id, user_id, reason, status
    )
    VALUES ($1, $2, $3, 'pending')
    RETURNING *
    `,
    [Number(reservationId), Number(userId), reason || null]
  );
  return mapRequest(result.rows[0]);
}

async function findPendingForReservation(reservationId, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT * FROM reservation_cancellation_requests
    WHERE reservation_id = $1 AND status = 'pending'
    LIMIT 1
    `,
    [Number(reservationId)]
  );
  return mapRequest(result.rows[0]);
}

async function findById(id, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      cr.*,
      r.status AS reservation_status,
      r.email AS customer_email,
      r.full_name AS customer_name
    FROM reservation_cancellation_requests cr
    JOIN reservations r ON r.id = cr.reservation_id
    WHERE cr.id = $1
    LIMIT 1
    `,
    [Number(id)]
  );
  return mapRequest(result.rows[0]);
}

async function listPending({ limit = 50 } = {}, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      cr.*,
      r.status AS reservation_status,
      r.email AS customer_email,
      r.full_name AS customer_name
    FROM reservation_cancellation_requests cr
    JOIN reservations r ON r.id = cr.reservation_id
    WHERE cr.status = 'pending'
    ORDER BY cr.created_at ASC
    LIMIT $1
    `,
    [Math.min(100, Math.max(1, Number(limit) || 50))]
  );
  return result.rows.map(mapRequest);
}

async function review({ id, status, adminNote, reviewedByUserId }, client = null) {
  const result = await clientQuery(
    client,
    `
    UPDATE reservation_cancellation_requests
    SET
      status = $2,
      admin_note = $3,
      reviewed_by_user_id = $4,
      reviewed_at = NOW(),
      updated_at = NOW()
    WHERE id = $1 AND status = 'pending'
    RETURNING *
    `,
    [Number(id), status, adminNote || null, reviewedByUserId ?? null]
  );
  return mapRequest(result.rows[0]);
}

async function findLatestForReservation(reservationId, userId = null, client = null) {
  const params = [Number(reservationId)];
  let userClause = '';
  if (userId != null) {
    params.push(Number(userId));
    userClause = ` AND user_id = $${params.length}`;
  }
  const result = await clientQuery(
    client,
    `
    SELECT * FROM reservation_cancellation_requests
    WHERE reservation_id = $1${userClause}
    ORDER BY created_at DESC
    LIMIT 1
    `,
    params
  );
  return mapRequest(result.rows[0]);
}

module.exports = {
  mapRequest,
  create,
  findPendingForReservation,
  findById,
  listPending,
  review,
  findLatestForReservation,
};
