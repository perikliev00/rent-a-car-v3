const { clientQuery } = require('../../../db/transaction');
const { mapSqlReservation, RESERVATION_SELECT } = require('./reservationMapper');

async function listByUserId(userId, { limit = 50 } = {}, client = null) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) {
    return [];
  }

  const result = await clientQuery(
    client,
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
    [id, Math.min(100, Math.max(1, Number(limit) || 50))]
  );

  return result.rows.map(mapSqlReservation);
}

async function findByIdForUser(reservationId, userId, client = null) {
  const rid = Number(reservationId);
  const uid = Number(userId);
  if (!Number.isInteger(rid) || rid <= 0 || !Number.isInteger(uid) || uid <= 0) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT
      ${RESERVATION_SELECT},
      c.name AS car_name
    FROM reservations r
    LEFT JOIN cars c ON c.id = r.car_id
    WHERE r.id = $1 AND r.user_id = $2
    LIMIT 1
    `,
    [rid, uid]
  );

  return mapSqlReservation(result.rows[0]) || null;
}

async function updateTravelDetails(reservationId, userId, travel, client = null) {
  const rid = Number(reservationId);
  const uid = Number(userId);
  if (!Number.isInteger(rid) || rid <= 0 || !Number.isInteger(uid) || uid <= 0) {
    return null;
  }

  const result = await clientQuery(
    client,
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
      rid,
      uid,
      travel.flightNumber !== undefined ? travel.flightNumber || null : null,
      travel.hotelName !== undefined ? travel.hotelName || null : null,
      travel.address !== undefined ? travel.address || null : null,
      travel.specialRequests !== undefined ? travel.specialRequests || null : null,
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  return findByIdForUser(rid, uid, client);
}

async function claimByEmail(userId, email, client = null) {
  const uid = Number(userId);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!Number.isInteger(uid) || uid <= 0 || !normalizedEmail) {
    return { reservations: 0, orders: 0 };
  }

  const reservationResult = await clientQuery(
    client,
    `
    UPDATE reservations
    SET user_id = $1, updated_at = NOW()
    WHERE user_id IS NULL
      AND email IS NOT NULL
      AND LOWER(email) = $2
    `,
    [uid, normalizedEmail]
  );

  const orderResult = await clientQuery(
    client,
    `
    UPDATE orders
    SET user_id = $1, updated_at = NOW()
    WHERE user_id IS NULL
      AND email IS NOT NULL
      AND LOWER(email) = $2
    `,
    [uid, normalizedEmail]
  );

  return {
    reservations: reservationResult.rowCount || 0,
    orders: orderResult.rowCount || 0,
  };
}

module.exports = {
  listByUserId,
  findByIdForUser,
  updateTravelDetails,
  claimByEmail,
};
