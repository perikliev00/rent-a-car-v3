const { clientQuery } = require('../../../db/transaction');
const { ACTIVE_RESERVATION_STATUSES } = require('../../../utils/reservationHelpers');
const {
  mapSqlReservation,
  RESERVATION_SELECT,
  normalizeCarId,
} = require('./reservationMapper');

/** Physically out — must stay unbookable until return checklist. */
const OPEN_PHYSICAL_RENTAL_STATUSES = Object.freeze(['picked_up', 'active_rental']);

async function findOpenPhysicalRental(carId, client = null, options = {}) {
  const normalizedCarId = normalizeCarId(carId);
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

async function carHasOpenPhysicalRental(carId, client = null) {
  const open = await findOpenPhysicalRental(carId, client);
  return Boolean(open);
}

async function findActiveBySessionId(sessionId, client = null) {
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

async function findBookedDateOverlap(carId, startDate, endDate, client = null) {
  const normalizedCarId = normalizeCarId(carId);
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

  if (!result.rowCount) {
    return null;
  }

  return { id: String(normalizedCarId) };
}

async function findById(id, client = null) {
  const reservationId = Number(id);
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

async function findByIdForUpdate(id, client = null) {
  const reservationId = Number(id);
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

async function findByStripeSessionId(stripeSessionId, client = null) {
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
