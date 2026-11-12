/**
 * Read-side reservation finds (by id, overlap, open physical rental, etc.).
 */
const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { ACTIVE_RESERVATION_STATUSES } = require('../../../utils/reservationHelpers');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  mapSqlReservation,
  // Contribute this line to the enclosing declaration or statement.
  RESERVATION_SELECT,
  // Contribute this line to the enclosing declaration or statement.
  normalizeCarId,
// Continue the surrounding logic with this statement.
} = require('./reservationMapper');

/** Physically out — must stay unbookable until return checklist. */
const OPEN_PHYSICAL_RENTAL_STATUSES = Object.freeze(['picked_up', 'active_rental']);

/**
 * Find open physical rental via SQL; returns null when missing.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @param {object} [options]
 * @returns {Promise<*>}
 */
async function findOpenPhysicalRental(carId, client = null, options = {}) {
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the params constant.
  const params = [normalizedCarId, OPEN_PHYSICAL_RENTAL_STATUSES];
  // Initialize the mutable exclude sql variable.
  let excludeSql = '';
  // Create the excluded reservation id constant.
  const excludedReservationId = Number(options.excludeReservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (Number.isInteger(excludedReservationId) && excludedReservationId > 0) {
    // Call params.push to perform this step.
    params.push(excludedReservationId);
    // Update excludeSql with the right-hand side value.
    excludeSql = ` AND r.id <> $${params.length}`;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${RESERVATION_SELECT}
    FROM reservations r
    WHERE r.car_id = $1
      AND r.status = ANY($2::text[])
      ${excludeSql}
    ORDER BY r.pickup_date ASC
    LIMIT 1
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * car has open physical rental.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function carHasOpenPhysicalRental(carId, client = null) {
  // Create the open constant.
  const open = await findOpenPhysicalRental(carId, client);
  // Return the resulting value to the caller.
  return Boolean(open);
}

/**
 * Find active by session id via SQL; returns null when missing.
 * @param {string|number} sessionId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findActiveBySessionId(sessionId, client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!sessionId) {
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
    WHERE r.session_id = $1
      AND r.status = ANY($2::text[])
      AND r.hold_expires_at > $3
    ORDER BY r.created_at DESC
    LIMIT 1
    `,
    // Continue the surrounding logic with this statement.
    [sessionId, ACTIVE_RESERVATION_STATUSES, new Date()]
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * Find an active pending hold overlapping the date range for a car.
 * Optional excludes avoid matching the caller's own session/reservation during rehold.
 * @param {object} params
 * @param {object|null} [client]
 * @returns {Promise<object|null>}
 */
async function findOverlappingHold(
  {
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
    // Update now with the right-hand side value.
    now = new Date(),
    // Update excludeSessionId with the right-hand side value.
    excludeSessionId = null,
    // Update excludeReservationId with the right-hand side value.
    excludeReservationId = null,
  },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Evaluate the condition and enter the branch when it is true.
  if (!normalizedCarId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the params constant.
  const params = [
    // Contribute this line to the enclosing declaration or statement.
    normalizedCarId,
    // Contribute this line to the enclosing declaration or statement.
    ACTIVE_RESERVATION_STATUSES,
    // Contribute this line to the enclosing declaration or statement.
    now,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
  ];
  // Initialize the mutable exclude sql variable.
  let excludeSql = '';

  // Evaluate the condition and enter the branch when it is true.
  if (excludeSessionId) {
    // Call params.push to perform this step.
    params.push(excludeSessionId);
    // Update excludeSql with the right-hand side value.
    excludeSql += ` AND r.session_id <> $${params.length}`;
  }

  // Create the excluded reservation id constant.
  const excludedReservationId = Number(excludeReservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (Number.isInteger(excludedReservationId) && excludedReservationId > 0) {
    // Call params.push to perform this step.
    params.push(excludedReservationId);
    // Update excludeSql with the right-hand side value.
    excludeSql += ` AND r.id <> $${params.length}`;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${RESERVATION_SELECT}
    FROM reservations r
    WHERE r.car_id = $1
      AND r.status = ANY($2::text[])
      AND r.hold_expires_at > $3
      AND r.pickup_date < $4
      AND r.return_date > $5
      ${excludeSql}
    LIMIT 1
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * Find booked date overlap via SQL; returns null when missing.
 * @param {string|number} carId
 * @param {*} startDate
 * @param {*} endDate
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findBookedDateOverlap(carId, startDate, endDate, client = null) {
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT 1
    FROM car_date_blocks b
    WHERE b.car_id = $1
      AND b.start_date < $3
      AND b.end_date > $2
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedCarId, startDate, endDate]
  );

  // Guard: early-return or throw when required input is missing/invalid.
  if (!result.rowCount) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return { id: String(normalizedCarId) };
}

/**
 * Find by id via SQL; returns null when missing.
 * @param {string|number} id
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findById(id, client = null) {
  // Create the reservation id constant.
  const reservationId = Number(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
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
    WHERE r.id = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * Find by id for update via SQL; returns null when missing.
 * @param {string|number} id
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByIdForUpdate(id, client = null) {
  // Create the reservation id constant.
  const reservationId = Number(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
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
    WHERE r.id = $1
    FOR UPDATE OF r
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [reservationId]
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * Find by stripe session id via SQL; returns null when missing.
 * @param {string|number} stripeSessionId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByStripeSessionId(stripeSessionId, client = null) {
  // Stripe / payment-related branch.
  if (!stripeSessionId) {
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
    WHERE r.stripe_session_id = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [stripeSessionId]
  );

  // Return the resulting value to the caller.
  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * Find processing with stripe session via SQL; returns null when missing.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findProcessingWithStripeSession(client = null) {
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
    WHERE r.status = 'processing_payment'
      AND r.stripe_session_id IS NOT NULL
    ORDER BY r.updated_at ASC
    `
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => mapSqlReservation(row)).filter(Boolean);
}

/**
 * Find processing with expired hold via SQL; returns null when missing.
 * @param {*} [now]
 * @returns {Promise<*>}
 */
async function findProcessingWithExpiredHold(now = new Date(), client = null) {
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
    WHERE r.status = 'processing_payment'
      AND r.stripe_session_id IS NOT NULL
      AND r.hold_expires_at <= $1
    ORDER BY r.updated_at ASC
    `,
    // Contribute this line to the enclosing declaration or statement.
    [now]
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => mapSqlReservation(row)).filter(Boolean);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  OPEN_PHYSICAL_RENTAL_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  findOpenPhysicalRental,
  // Contribute this line to the enclosing declaration or statement.
  carHasOpenPhysicalRental,
  // Contribute this line to the enclosing declaration or statement.
  findActiveBySessionId,
  // Contribute this line to the enclosing declaration or statement.
  findById,
  // Contribute this line to the enclosing declaration or statement.
  findByIdForUpdate,
  // Contribute this line to the enclosing declaration or statement.
  findByStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  findProcessingWithStripeSession,
  // Contribute this line to the enclosing declaration or statement.
  findProcessingWithExpiredHold,
  // Contribute this line to the enclosing declaration or statement.
  findOverlappingHold,
  // Contribute this line to the enclosing declaration or statement.
  findBookedDateOverlap,
};
