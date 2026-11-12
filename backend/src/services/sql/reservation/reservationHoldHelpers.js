/**
 * Shared helpers for hold window math and overlap predicates.
 */
const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { ACTIVE_RESERVATION_STATUSES } = require('../../../utils/reservationHelpers');
// Destructure object properties into local variables.
const { normalizeCarId } = require('./reservationMapper');

/**
 * Resolve reservation car id from inputs / Stripe / DB.
 * @param {object} reservation
 * @returns {*}
 */
function resolveReservationCarId(reservation) {
  // Return the resulting value to the caller.
  return normalizeCarId(reservation?.carId?.id || reservation?.carId);
}

/**
 * Transform helper: to iso.
 * @param {*} value
 * @returns {*}
 */
function toIso(value) {
  // Evaluate the condition and enter the branch when it is true.
  if (value instanceof Date) {
    // Return the resulting value to the caller.
    return value.toISOString();
  }
  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return [];
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, car_id, status, hold_expires_at
    FROM reservations
    WHERE session_id = $1
      AND status = ANY($2::text[])
    ORDER BY id
    `,
    // Contribute this line to the enclosing declaration or statement.
    [sessionId, ACTIVE_RESERVATION_STATUSES]
  );

  // Return the resulting value to the caller.
  return result.rows || [];
}

/**
 * empty create result.
 * @param {*} [overrides]
 * @returns {*}
 */
function emptyCreateResult(overrides = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the reservation field value.
    reservation: null,
    // Provide the existing active reservation field value.
    existingActiveReservation: null,
    // Provide the overlapping reservation field value.
    overlappingReservation: null,
    // Provide the booked overlap field value.
    bookedOverlap: null,
    // Spread overrides into the surrounding structure.
    ...overrides,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  resolveReservationCarId,
  // Contribute this line to the enclosing declaration or statement.
  toIso,
  // Contribute this line to the enclosing declaration or statement.
  findSessionHoldRows,
  // Contribute this line to the enclosing declaration or statement.
  emptyCreateResult,
};
