const { formatDateForDisplay } = require('./dateFormatter');
const { HOLD_WINDOW_MS } = require('../config/reservationTiming');
const {
  ACTIVE_HOLD_STATUSES,
  ACTIVE_RESERVATION_STATUSES,
} = require('../domain/reservationStatus');

function getSessionId(req) {
  return (req.session && (req.session._sid || req.sessionID)) || req.sessionID;
}

function buildExistingReservationSummary(reservation) {
  if (!reservation) return null;
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
