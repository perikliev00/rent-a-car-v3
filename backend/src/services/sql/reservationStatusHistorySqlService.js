/**
 * Append/list reservation_status_history for audit and ops detail views.
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Append a reservation_status_history row for audit / ops timelines.
 * @param {object} params
 * @param {object|null} [client]
 * @returns {Promise<{ id: *, created_at: * }>}
 * @throws {Error} when reservationId or newStatus is missing
 */
async function insertStatusHistory(
  {
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Update oldStatus with the right-hand side value.
    oldStatus = null,
    // Contribute this line to the enclosing declaration or statement.
    newStatus,
    // Update changedByUserId with the right-hand side value.
    changedByUserId = null,
    // Update changedBySystem with the right-hand side value.
    changedBySystem = false,
    // Update reason with the right-hand side value.
    reason = null,
    // Update metadata with the right-hand side value.
    metadata = null,
  },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Evaluate the condition and enter the branch when it is true.
  if (!reservationId || !newStatus) {
    // Throw an error to stop the current control flow.
    throw new Error('Status history requires reservationId and newStatus');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Contribute this line to the enclosing declaration or statement.
      oldStatus,
      // Contribute this line to the enclosing declaration or statement.
      newStatus,
      // Contribute this line to the enclosing declaration or statement.
      changedByUserId,
      // Call Boolean to perform this step.
      Boolean(changedBySystem),
      // Contribute this line to the enclosing declaration or statement.
      reason,
      // Contribute this line to the enclosing declaration or statement.
      metadata,
    ]
  );

  // Return the resulting value to the caller.
  return result.rows[0];
}

/**
 * List history for reservation from SQL.
 * @param {string|number} reservationId
 * @param {number} [{ limit]
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listHistoryForReservation(reservationId, { limit = 50 } = {}, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Continue the surrounding logic with this statement.
    [reservationId, Math.min(200, Math.max(1, Number(limit) || 50))]
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => ({
    // Provide the id field value.
    id: Number(row.id),
    // Provide the reservation id field value.
    reservationId: String(row.reservation_id),
    // Provide the old status field value.
    oldStatus: row.old_status,
    // Provide the new status field value.
    newStatus: row.new_status,
    // Provide the changed by user id field value.
    changedByUserId: row.changed_by_user_id != null ? Number(row.changed_by_user_id) : null,
    // Provide the changed by system field value.
    changedBySystem: Boolean(row.changed_by_system),
    // Provide the changed by email field value.
    changedByEmail: row.changed_by_email || null,
    // Provide the reason field value.
    reason: row.reason,
    // Provide the metadata field value.
    metadata: row.metadata,
    // Provide the created at field value.
    createdAt: row.created_at,
  }));
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  insertStatusHistory,
  // Contribute this line to the enclosing declaration or statement.
  listHistoryForReservation,
};
