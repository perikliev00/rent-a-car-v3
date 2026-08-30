const { clientQuery } = require('../../../db/transaction');
const { ACTIVE_RESERVATION_STATUSES } = require('../../../utils/reservationHelpers');
const { normalizeCarId } = require('./reservationMapper');

function resolveReservationCarId(reservation) {
  return normalizeCarId(reservation?.carId?.id || reservation?.carId);
}

function toIso(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value ?? null;
}

async function findSessionHoldRows(sessionId, client) {
  if (!sessionId) {
    return [];
  }

  const result = await clientQuery(
    client,
    `
    SELECT id, car_id, status, hold_expires_at
    FROM reservations
    WHERE session_id = $1
      AND status = ANY($2::text[])
    ORDER BY id
    `,
    [sessionId, ACTIVE_RESERVATION_STATUSES]
  );

  return result.rows || [];
}

function emptyCreateResult(overrides = {}) {
  return {
    reservation: null,
    existingActiveReservation: null,
    overlappingReservation: null,
    bookedOverlap: null,
    ...overrides,
  };
}

module.exports = {
  resolveReservationCarId,
  toIso,
  findSessionHoldRows,
  emptyCreateResult,
};
