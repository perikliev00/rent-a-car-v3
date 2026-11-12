/**
 * Small helpers shared by reservation/hold controllers (session id, existing-reservation summary).
 * Also re-exports hold timing and active status constants for convenience.
 */

const { formatDateForDisplay } = require('./dateFormatter');
// Destructure object properties into local variables.
const { HOLD_WINDOW_MS } = require('../config/reservationTiming');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_HOLD_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_RESERVATION_STATUSES,
// Continue the surrounding logic with this statement.
} = require('../domain/reservationStatus');

/**
 * Resolve a stable session identifier from the Express request.
 *
 * @param {import('express').Request} req
 * @returns {string | undefined}
 * @throws {never}
 */
function getSessionId(req) {
  // Prefer custom _sid when present; else fall back to express-session's sessionID.
  return (req.session && (req.session._sid || req.sessionID)) || req.sessionID;
}

/**
 * Build a short, display-ready summary of an existing reservation for conflict responses.
 *
 * @param {Record<string, unknown> | null | undefined} reservation
 * @returns {{ carName: string, pickupDate: string, returnDate: string, totalPrice: string | null } | null}
 * @throws {never}
 */
function buildExistingReservationSummary(reservation) {
  // Evaluate the condition and enter the branch when it is true.
  if (!reservation) return null;
  // carId may be populated or a bare id — only use the name when populated.
  const carName = reservation.carId && reservation.carId.name ? reservation.carId.name : 'Reserved car';
  // Create the total price constant.
  const totalPrice =
    // Continue the surrounding logic with this statement.
    reservation.totalPrice != null && typeof reservation.totalPrice === 'number'
      // Continue the surrounding logic with this statement.
      ? reservation.totalPrice.toFixed(2)
      // Contribute this line to the enclosing declaration or statement.
      : null;
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    carName,
    // Provide the pickup date field value.
    pickupDate: formatDateForDisplay(reservation.pickupDate),
    // Provide the return date field value.
    returnDate: formatDateForDisplay(reservation.returnDate),
    // Contribute this line to the enclosing declaration or statement.
    totalPrice,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_HOLD_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_RESERVATION_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  HOLD_WINDOW_MS,
  // Contribute this line to the enclosing declaration or statement.
  getSessionId,
  // Contribute this line to the enclosing declaration or statement.
  buildExistingReservationSummary,
};
