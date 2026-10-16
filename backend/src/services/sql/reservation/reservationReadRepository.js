/**
 * Read-side reservation finds (by id, overlap, open physical rental, etc.).
 */
const { clientQuery } = require('../../../db/transaction');
const { ACTIVE_RESERVATION_STATUSES } = require('../../../utils/reservationHelpers');
const {
  mapSqlReservation,
  RESERVATION_SELECT,
  normalizeCarId,
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
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    return null;
  }

  const params = [normalizedCarId, OPEN_PHYSICAL_RENTAL_STATUSES];
  let excludeSql = '';
  const excludedReservationId = Number(options.excludeReservationId);
  if (Number.isInteger(excludedReservationId) && excludedReservationId > 0) {
    params.push(excludedReservationId);
    excludeSql = ` AND r.id <> $${params.length}`;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${RESERVATION_SELECT}
    FROM reservations r
    WHERE r.car_id = $1
      AND r.status = ANY($2::text[])
      ${excludeSql}
    ORDER BY r.pickup_date ASC
    LIMIT 1
    `,
    params
  );

  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * car has open physical rental.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function carHasOpenPhysicalRental(carId, client = null) {
  const open = await findOpenPhysicalRental(carId, client);
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
    WHERE r.session_id = $1
      AND r.status = ANY($2::text[])
      AND r.hold_expires_at > $3
    ORDER BY r.created_at DESC
    LIMIT 1
    `,
    [sessionId, ACTIVE_RESERVATION_STATUSES, new Date()]
  );

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
    carId,
    startDate,
    endDate,
    now = new Date(),
    excludeSessionId = null,
    excludeReservationId = null,
  },
  client = null
) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    return null;
  }

  const params = [
    normalizedCarId,
    ACTIVE_RESERVATION_STATUSES,
    now,
    endDate,
    startDate,
  ];
  let excludeSql = '';

  if (excludeSessionId) {
    params.push(excludeSessionId);
    excludeSql += ` AND r.session_id <> $${params.length}`;
  }

  const excludedReservationId = Number(excludeReservationId);
  if (Number.isInteger(excludedReservationId) && excludedReservationId > 0) {
    params.push(excludedReservationId);
    excludeSql += ` AND r.id <> $${params.length}`;
  }

  const result = await clientQuery(
    client,
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
    params
  );

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
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT 1
    FROM car_date_blocks b
    WHERE b.car_id = $1
      AND b.start_date < $3
      AND b.end_date > $2
    LIMIT 1
    `,
    [normalizedCarId, startDate, endDate]
  );

  // Guard: early-return or throw when required input is missing/invalid.
  if (!result.rowCount) {
    return null;
  }

  return { id: String(normalizedCarId) };
}

/**
 * Find by id via SQL; returns null when missing.
 * @param {string|number} id
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findById(id, client = null) {
  const reservationId = Number(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
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
    WHERE r.id = $1
    LIMIT 1
    `,
    [reservationId]
  );

  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * Find by id for update via SQL; returns null when missing.
 * @param {string|number} id
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findByIdForUpdate(id, client = null) {
  const reservationId = Number(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
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
    WHERE r.id = $1
    FOR UPDATE OF r
    LIMIT 1
    `,
    [reservationId]
  );

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
    WHERE r.stripe_session_id = $1
    LIMIT 1
    `,
    [stripeSessionId]
  );

  return mapSqlReservation(result.rows[0]) || null;
}

/**
 * Find processing with stripe session via SQL; returns null when missing.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findProcessingWithStripeSession(client = null) {
  const result = await clientQuery(
    client,
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

  return result.rows.map((row) => mapSqlReservation(row)).filter(Boolean);
}

/**
 * Find processing with expired hold via SQL; returns null when missing.
 * @param {*} [now]
 * @returns {Promise<*>}
 */
async function findProcessingWithExpiredHold(now = new Date(), client = null) {
  const result = await clientQuery(
    client,
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
    [now]
  );

  return result.rows.map((row) => mapSqlReservation(row)).filter(Boolean);
}

module.exports = {
  OPEN_PHYSICAL_RENTAL_STATUSES,
  findOpenPhysicalRental,
  carHasOpenPhysicalRental,
  findActiveBySessionId,
  findById,
  findByIdForUpdate,
  findByStripeSessionId,
  findProcessingWithStripeSession,
  findProcessingWithExpiredHold,
  findOverlappingHold,
  findBookedDateOverlap,
};
