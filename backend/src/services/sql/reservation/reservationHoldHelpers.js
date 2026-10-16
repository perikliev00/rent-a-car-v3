/**
 * Shared helpers for hold window math and overlap predicates.
 */
const { clientQuery } = require('../../../db/transaction');
const { ACTIVE_RESERVATION_STATUSES } = require('../../../utils/reservationHelpers');
const { normalizeCarId } = require('./reservationMapper');

/**
 * Resolve reservation car id from inputs / Stripe / DB.
 * @param {object} reservation
 * @returns {*}
 */
function resolveReservationCarId(reservation) {
  return normalizeCarId(reservation?.carId?.id || reservation?.carId);
}

/**
 * Transform helper: to iso.
 * @param {*} value
 * @returns {*}
 */
function toIso(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value ?? null;
}

/**
 * Find session hold rows via SQL; returns null when missing.
 * @param {string|number} sessionId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findSessionHoldRows(sessionId, client) {
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * empty create result.
 * @param {*} [overrides]
 * @returns {*}
 */
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
