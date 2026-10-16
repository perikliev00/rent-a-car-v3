/**
 * Small helpers shared by reservation/hold controllers (session id, existing-reservation summary).
 * Also re-exports hold timing and active status constants for convenience.
 */

const { formatDateForDisplay } = require('./dateFormatter');
const { HOLD_WINDOW_MS } = require('../config/reservationTiming');
const {
  ACTIVE_HOLD_STATUSES,
  ACTIVE_RESERVATION_STATUSES,
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
  if (!reservation) return null;
  // carId may be populated or a bare id — only use the name when populated.
  const carName = reservation.carId && reservation.carId.name ? reservation.carId.name : 'Reserved car';
  const totalPrice =
    reservation.totalPrice != null && typeof reservation.totalPrice === 'number'
      ? reservation.totalPrice.toFixed(2)
      : null;
  return {
    carName,
    pickupDate: formatDateForDisplay(reservation.pickupDate),
    returnDate: formatDateForDisplay(reservation.returnDate),
    totalPrice,
  };
}

module.exports = {
  ACTIVE_HOLD_STATUSES,
  ACTIVE_RESERVATION_STATUSES,
  HOLD_WINDOW_MS,
  getSessionId,
  buildExistingReservationSummary,
};
