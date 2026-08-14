const { clientQuery } = require('../../db/transaction');

async function insertStatusHistory(
  {
    reservationId,
    oldStatus = null,
    newStatus,
    changedByUserId = null,
    changedBySystem = false,
    reason = null,
    metadata = null,
  },
  client = null
) {
  if (!reservationId || !newStatus) {
    throw new Error('Status history requires reservationId and newStatus');
  }

  const result = await clientQuery(
    client,
    `
    INSERT INTO reservation_status_history (
      reservation_id,
      old_status,
      new_status,
      changed_by_user_id,
      changed_by_system,
      reason,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at
    `,
    [
      reservationId,
      oldStatus,
      newStatus,
      changedByUserId,
      Boolean(changedBySystem),
      reason,
      metadata,
    ]
  );

  return result.rows[0];
}

async function listHistoryForReservation(reservationId, { limit = 50 } = {}, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      h.id,
      h.reservation_id,
      h.old_status,
      h.new_status,
      h.changed_by_user_id,
      h.changed_by_system,
      h.reason,
      h.metadata,
      h.created_at,
      u.email AS changed_by_email
    FROM reservation_status_history h
    LEFT JOIN users u ON u.id = h.changed_by_user_id
    WHERE h.reservation_id = $1
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT $2
    `,
    [reservationId, Math.min(200, Math.max(1, Number(limit) || 50))]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    reservationId: String(row.reservation_id),
    oldStatus: row.old_status,
    newStatus: row.new_status,
    changedByUserId: row.changed_by_user_id != null ? Number(row.changed_by_user_id) : null,
    changedBySystem: Boolean(row.changed_by_system),
    changedByEmail: row.changed_by_email || null,
    reason: row.reason,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

module.exports = {
  insertStatusHistory,
  listHistoryForReservation,
};
