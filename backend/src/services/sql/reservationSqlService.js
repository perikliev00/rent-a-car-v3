/**
 * Facade re-exporting reservation repositories for holds, lifecycle, and reads.
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_STATUS_SQL,
  // Contribute this line to the enclosing declaration or statement.
  mapSqlReservation,
// Continue the surrounding logic with this statement.
} = require('./reservation/reservationMapper');
// Destructure object properties into local variables.
const {
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
// Continue the surrounding logic with this statement.
} = require('./reservation/reservationReadRepository');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  expireStaleHoldsForCar,
  // Contribute this line to the enclosing declaration or statement.
  expireStaleHoldsForSession,
  // Contribute this line to the enclosing declaration or statement.
  createPendingReservation,
  // Contribute this line to the enclosing declaration or statement.
  createPendingReservationWithAvailabilityCheck,
  // Contribute this line to the enclosing declaration or statement.
  reholdPendingReservationWithAvailabilityCheck,
  // Contribute this line to the enclosing declaration or statement.
  markReservationExpired,
  // Contribute this line to the enclosing declaration or statement.
  markAbandonedReservations,
// Continue the surrounding logic with this statement.
} = require('./reservation/reservationHoldRepository');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  update,
  // Contribute this line to the enclosing declaration or statement.
  applyStatusChange,
  // Contribute this line to the enclosing declaration or statement.
  reserveCheckoutAttempt,
  // Contribute this line to the enclosing declaration or statement.
  createConfirmedReservation,
// Continue the surrounding logic with this statement.
} = require('./reservation/reservationLifecycleRepository');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listByUserId,
  // Contribute this line to the enclosing declaration or statement.
  findByIdForUser,
  // Contribute this line to the enclosing declaration or statement.
  updateTravelDetails,
  // Contribute this line to the enclosing declaration or statement.
  claimByEmail,
// Continue the surrounding logic with this statement.
} = require('./reservation/reservationAccountRepository');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_STATUS_SQL,
  // Contribute this line to the enclosing declaration or statement.
  OPEN_PHYSICAL_RENTAL_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  mapSqlReservation,
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
  markReservationExpired,
  // Contribute this line to the enclosing declaration or statement.
  findOverlappingHold,
  // Contribute this line to the enclosing declaration or statement.
  findBookedDateOverlap,
  // Contribute this line to the enclosing declaration or statement.
  expireStaleHoldsForCar,
  // Contribute this line to the enclosing declaration or statement.
  expireStaleHoldsForSession,
  // Contribute this line to the enclosing declaration or statement.
  createPendingReservation,
  // Contribute this line to the enclosing declaration or statement.
  createPendingReservationWithAvailabilityCheck,
  // Contribute this line to the enclosing declaration or statement.
  reholdPendingReservationWithAvailabilityCheck,
  // Contribute this line to the enclosing declaration or statement.
  createConfirmedReservation,
  // Contribute this line to the enclosing declaration or statement.
  update,
  // Contribute this line to the enclosing declaration or statement.
  applyStatusChange,
  // Contribute this line to the enclosing declaration or statement.
  reserveCheckoutAttempt,
  // Contribute this line to the enclosing declaration or statement.
  markAbandonedReservations,
  // Contribute this line to the enclosing declaration or statement.
  listByUserId,
  // Contribute this line to the enclosing declaration or statement.
  findByIdForUser,
  // Contribute this line to the enclosing declaration or statement.
  updateTravelDetails,
  // Contribute this line to the enclosing declaration or statement.
  claimByEmail,
};
