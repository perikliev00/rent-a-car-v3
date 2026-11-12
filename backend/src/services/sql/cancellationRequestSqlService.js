/**
 * SQL for customer cancellation_requests (pending list, find, review).
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapRequest).
 * @param {object} row
 * @returns {*}
 */
function mapRequest(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the reservation id field value.
    reservationId: String(row.reservation_id),
    // Provide the user id field value.
    userId: String(row.user_id),
    // Provide the reason field value.
    reason: row.reason || null,
    // Provide the status field value.
    status: row.status,
    // Provide the admin note field value.
    adminNote: row.admin_note || null,
    // Provide the reviewed by user id field value.
    reviewedByUserId:
      // Continue the surrounding logic with this statement.
      row.reviewed_by_user_id != null ? Number(row.reviewed_by_user_id) : null,
    // Provide the reviewed at field value.
    reviewedAt: row.reviewed_at || null,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
    // Provide the reservation status field value.
    reservationStatus: row.reservation_status || undefined,
    // Provide the customer email field value.
    customerEmail: row.customer_email || undefined,
    // Provide the customer name field value.
    customerName: row.customer_name || undefined,
  };
}

/**
 * Insert a new row and return the mapped result.
 * @param {object} params
 * @param {object|null} [client] Optional DB client/transaction
 * @returns {Promise<*>}
 */
async function create({ reservationId, userId, reason }, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO reservation_cancellation_requests (
      reservation_id, user_id, reason, status
    )
    VALUES ($1, $2, $3, 'pending')
    RETURNING *
    `,
    // Continue the surrounding logic with this statement.
    [Number(reservationId), Number(userId), reason || null]
  );
  // Return the resulting value to the caller.
  return mapRequest(result.rows[0]);
}

/**
 * Find pending for reservation via SQL; returns null when missing.
 * @param {string|number} reservationId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findPendingForReservation(reservationId, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT * FROM reservation_cancellation_requests
    WHERE reservation_id = $1 AND status = 'pending'
    LIMIT 1
    `,
    // Continue the surrounding logic with this statement.
    [Number(reservationId)]
  );
  // Return the resulting value to the caller.
  return mapRequest(result.rows[0]);
}

/**
 * Find by id via SQL; returns null when missing.
 * @param {string|number} id
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findById(id, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Continue the surrounding logic with this statement.
    [Number(id)]
  );
  // Return the resulting value to the caller.
  return mapRequest(result.rows[0]);
}

/**
 * List pending from SQL.
 * @param {object} params
 * @param {object|null} [client] Optional DB client/transaction
 * @returns {Promise<*>}
 */
async function listPending({ limit = 50 } = {}, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Continue the surrounding logic with this statement.
    [Math.min(100, Math.max(1, Number(limit) || 50))]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapRequest);
}

/**
 * review.
 * @param {object} params
 * @param {object|null} [client] Optional DB client/transaction
 * @returns {Promise<*>}
 */
async function review({ id, status, adminNote, reviewedByUserId }, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Continue the surrounding logic with this statement.
    [Number(id), status, adminNote || null, reviewedByUserId ?? null]
  );
  // Return the resulting value to the caller.
  return mapRequest(result.rows[0]);
}

/**
 * Find latest for reservation via SQL; returns null when missing.
 * @param {string|number} reservationId
 * @param {string|number} [userId]
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findLatestForReservation(reservationId, userId = null, client = null) {
  // Create the params constant.
  const params = [Number(reservationId)];
  // Initialize the mutable user clause variable.
  let userClause = '';
  // Evaluate the condition and enter the branch when it is true.
  if (userId != null) {
    // Call params.push to perform this step.
    params.push(Number(userId));
    // Update userClause with the right-hand side value.
    userClause = ` AND user_id = $${params.length}`;
  }
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT * FROM reservation_cancellation_requests
    WHERE reservation_id = $1${userClause}
    ORDER BY created_at DESC
    LIMIT 1
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Return the resulting value to the caller.
  return mapRequest(result.rows[0]);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapRequest,
  // Contribute this line to the enclosing declaration or statement.
  create,
  // Contribute this line to the enclosing declaration or statement.
  findPendingForReservation,
  // Contribute this line to the enclosing declaration or statement.
  findById,
  // Contribute this line to the enclosing declaration or statement.
  listPending,
  // Contribute this line to the enclosing declaration or statement.
  review,
  // Contribute this line to the enclosing declaration or statement.
  findLatestForReservation,
};
