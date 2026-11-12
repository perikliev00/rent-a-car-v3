/**
 * Reservation queries scoped to customer accounts (my bookings).
 */
const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { mapSqlReservation, RESERVATION_SELECT } = require('./reservationMapper');

/**
 * List by user id from SQL.
 * @param {string|number} userId
 * @param {number} [{ limit]
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listByUserId(userId, { limit = 50 } = {}, client = null) {
  // Create the id constant.
  const id = Number(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    // Return the resulting value to the caller.
    return [];
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      ${RESERVATION_SELECT},
      c.name AS car_name
    FROM reservations r
    LEFT JOIN cars c ON c.id = r.car_id
    WHERE r.user_id = $1
    ORDER BY r.pickup_date DESC, r.id DESC
    LIMIT $2
    `,
    // Continue the surrounding logic with this statement.
    [id, Math.min(100, Math.max(1, Number(limit) || 50))]
  );

  // Return the resulting value to the caller.
  return result.rows.map(mapSqlReservation);
}

/**
 * Find by id for user via SQL; returns null when missing.
 * @param {string|number} reservationId
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByIdForUser(reservationId, userId, client = null) {
  // Create the rid constant.
  const rid = Number(reservationId);
  // Create the uid constant.
  const uid = Number(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(rid) || rid <= 0 || !Number.isInteger(uid) || uid <= 0) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      ${RESERVATION_SELECT},
      c.name AS car_name
    FROM reservations r
    LEFT JOIN cars c ON c.id = r.car_id
    WHERE r.id = $1 AND r.user_id = $2
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [rid, uid]
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * Update or upsert travel details; returns null when not found.
 * @param {string|number} reservationId
 * @param {string|number} userId
 * @param {*} travel
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function updateTravelDetails(reservationId, userId, travel, client = null) {
  // Create the rid constant.
  const rid = Number(reservationId);
  // Create the uid constant.
  const uid = Number(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(rid) || rid <= 0 || !Number.isInteger(uid) || uid <= 0) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE reservations
    SET
      flight_number = COALESCE($3, flight_number),
      hotel_name = COALESCE($4, hotel_name),
      address = COALESCE($5, address),
      special_requests = COALESCE($6, special_requests),
      updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      rid,
      // Contribute this line to the enclosing declaration or statement.
      uid,
      // Continue the surrounding logic with this statement.
      travel.flightNumber !== undefined ? travel.flightNumber || null : null,
      // Continue the surrounding logic with this statement.
      travel.hotelName !== undefined ? travel.hotelName || null : null,
      // Continue the surrounding logic with this statement.
      travel.address !== undefined ? travel.address || null : null,
      // Continue the surrounding logic with this statement.
      travel.specialRequests !== undefined ? travel.specialRequests || null : null,
    ]
  );

  // Guard: early-return or throw when required input is missing/invalid.
  if (!result.rows[0]) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return findByIdForUser(rid, uid, client);
}

/**
 * claim by email.
 * @param {string|number} userId
 * @param {string} email
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function claimByEmail(userId, email, client = null) {
  // Create the uid constant.
  const uid = Number(userId);
  // Create the normalized email constant.
  const normalizedEmail = String(email || '').trim().toLowerCase();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(uid) || uid <= 0 || !normalizedEmail) {
    // Return the resulting value to the caller.
    return { reservations: 0, orders: 0 };
  }

  // Create the reservation result constant.
  const reservationResult = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE reservations
    SET user_id = $1, updated_at = NOW()
    WHERE user_id IS NULL
      AND email IS NOT NULL
      AND LOWER(email) = $2
    `,
    // Contribute this line to the enclosing declaration or statement.
    [uid, normalizedEmail]
  );

  // Create the order result constant.
  const orderResult = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE orders
    SET user_id = $1, updated_at = NOW()
    WHERE user_id IS NULL
      AND email IS NOT NULL
      AND LOWER(email) = $2
    `,
    // Contribute this line to the enclosing declaration or statement.
    [uid, normalizedEmail]
  );

  // Return the resulting value to the caller.
  return {
    // Provide the reservations field value.
    reservations: reservationResult.rowCount || 0,
    // Provide the orders field value.
    orders: orderResult.rowCount || 0,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listByUserId,
  // Contribute this line to the enclosing declaration or statement.
  findByIdForUser,
  // Contribute this line to the enclosing declaration or statement.
  updateTravelDetails,
  // Contribute this line to the enclosing declaration or statement.
  claimByEmail,
};
