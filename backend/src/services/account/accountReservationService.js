/**
 * My Account reservation APIs: dashboard, list/detail, travel updates,
 * cancellation (immediate for unpaid holds; request queue for paid bookings).
 */
const reservationSql = require('../sql/reservationSqlService');
// Require the '../sql/orderSqlService' module as orderSql.
const orderSql = require('../sql/orderSqlService');
// Require the '../sql/cancellationRequestSqlService' module as cancellationSql.
const cancellationSql = require('../sql/cancellationRequestSqlService');
// Require the '../sql/pickupChecklistSqlService' module as pickupSql.
const pickupSql = require('../sql/pickupChecklistSqlService');
// Require the '../sql/returnChecklistSqlService' module as returnSql.
const returnSql = require('../sql/returnChecklistSqlService');
// Destructure object properties into local variables.
const { changeStatus } = require('../reservation/reservationStatusService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildPickupInstructions,
  // Contribute this line to the enclosing declaration or statement.
  buildReturnInstructions,
// Continue the surrounding logic with this statement.
} = require('./instructionsService');
// Destructure object properties into local variables.
const { isTerminal } = require('../../domain/reservationStatus');
// Destructure object properties into local variables.
const { isUniqueViolation } = require('../../db/transaction');

/** Unpaid hold statuses — customer may cancel immediately without admin review. */
const HOLD_STATUSES = new Set(['pending_payment', 'processing_payment']);
/** Paid/ops statuses that require a cancellation request for staff approval. */
const REQUEST_CANCEL_STATUSES = new Set([
  // Supply the literal value used by the enclosing expression.
  'paid',
  // Supply the literal value used by the enclosing expression.
  'confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_prepared',
  // Supply the literal value used by the enclosing expression.
  'manual_review',
]);

// Create the payment paid statuses constant.
const PAYMENT_PAID_STATUSES = new Set([
  // Supply the literal value used by the enclosing expression.
  'paid',
  // Supply the literal value used by the enclosing expression.
  'confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_prepared',
  // Supply the literal value used by the enclosing expression.
  'picked_up',
  // Supply the literal value used by the enclosing expression.
  'active_rental',
  // Supply the literal value used by the enclosing expression.
  'returned',
  // Supply the literal value used by the enclosing expression.
  'completed',
]);

/**
 * Coarse payment label for the account UI (not a separate payments table).
 * @param {string} status
 * @returns {string}
 */
function paymentStatusLabel(status) {
  // Status / lifecycle guard before mutating domain state.
  if (HOLD_STATUSES.has(status)) return 'pending';
  // Status / lifecycle guard before mutating domain state.
  if (status === 'manual_review') return 'manual_review';
  // Status / lifecycle guard before mutating domain state.
  if (status === 'refunded') return 'refunded';
  // Status / lifecycle guard before mutating domain state.
  if (status === 'expired' || status === 'cancelled') return status;
  // Status / lifecycle guard before mutating domain state.
  if (PAYMENT_PAID_STATUSES.has(status)) return 'paid';
  // Return the resulting value to the caller.
  return status;
}

/**
 * Map a reservation row to the public account DTO.
 * @param {object} reservation
 * @param {object} [extras]
 * @returns {object}
 */
function toPublicReservation(reservation, extras = {}) {
  // Create the car name constant.
  const carName =
    // Continue the surrounding logic with this statement.
    reservation.carId && typeof reservation.carId === 'object'
      // Contribute this line to the enclosing declaration or statement.
      ? reservation.carId.name
      // Contribute this line to the enclosing declaration or statement.
      : extras.carName;

  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: reservation.id,
    // Provide the status field value.
    status: reservation.status,
    // Provide the payment status field value.
    paymentStatus: paymentStatusLabel(reservation.status),
    // Provide the car id field value.
    carId:
      // Continue the surrounding logic with this statement.
      reservation.carId && typeof reservation.carId === 'object'
        // Contribute this line to the enclosing declaration or statement.
        ? reservation.carId.id
        // Contribute this line to the enclosing declaration or statement.
        : reservation.carId,
    // Provide the car name field value.
    carName: carName || null,
    // Provide the pickup date field value.
    pickupDate: reservation.pickupDate,
    // Provide the pickup time field value.
    pickupTime: reservation.pickupTime || null,
    // Provide the return date field value.
    returnDate: reservation.returnDate,
    // Provide the return time field value.
    returnTime: reservation.returnTime || null,
    // Provide the pickup location field value.
    pickupLocation: reservation.pickupLocation,
    // Provide the return location field value.
    returnLocation: reservation.returnLocation,
    // Provide the rental days field value.
    rentalDays: reservation.rentalDays,
    // Provide the total price field value.
    totalPrice: reservation.totalPrice,
    // Provide the deposit field value.
    deposit: reservation.deposit,
    // Provide the full name field value.
    fullName: reservation.fullName || null,
    // Provide the email field value.
    email: reservation.email || null,
    // Provide the phone number field value.
    phoneNumber: reservation.phoneNumber || null,
    // Provide the address field value.
    address: reservation.address || null,
    // Provide the hotel name field value.
    hotelName: reservation.hotelName || null,
    // Provide the flight number field value.
    flightNumber: reservation.flightNumber || null,
    // Provide the special requests field value.
    specialRequests: reservation.specialRequests || null,
    // Provide the selected extras field value.
    selectedExtras: reservation.selectedExtras || [],
    // Provide the hotel delivery field value.
    hotelDelivery: Boolean(reservation.hotelDelivery),
    // Provide the created at field value.
    createdAt: reservation.createdAt,
    // Spread extras into the surrounding structure.
    ...extras,
  };
}

/**
 * @param {string|number} userId
 * @returns {Promise<object>}
 */
async function getDashboard(userId) {
  // Create the reservations constant.
  const reservations = await reservationSql.listByUserId(userId, { limit: 100 });
  // Create the upcoming constant.
  const upcoming = reservations.find((r) =>
    // Continue the surrounding logic with this statement.
    ['confirmed', 'car_prepared', 'paid', 'picked_up', 'active_rental'].includes(r.status)
  );
  // Create the active count constant.
  const activeCount = reservations.filter((r) =>
    // Continue the surrounding logic with this statement.
    ['confirmed', 'car_prepared', 'picked_up', 'active_rental', 'paid'].includes(r.status)
  // Continue the surrounding logic with this statement.
  ).length;
  // Create the completed count constant.
  const completedCount = reservations.filter((r) => r.status === 'completed').length;

  // Return the resulting value to the caller.
  return {
    // Provide the counts field value.
    counts: {
      // Provide the total field value.
      total: reservations.length,
      // Provide the active field value.
      active: activeCount,
      // Provide the completed field value.
      completed: completedCount,
    },
    // Provide the upcoming field value.
    upcoming: upcoming ? toPublicReservation(upcoming) : null,
    // Provide the recent field value.
    recent: reservations.slice(0, 5).map((r) => toPublicReservation(r)),
  };
}

/**
 * @param {string|number} userId
 * @returns {Promise<object[]>}
 */
async function listReservations(userId) {
  // Create the reservations constant.
  const reservations = await reservationSql.listByUserId(userId, { limit: 100 });
  // Return the resulting value to the caller.
  return reservations.map((r) => toPublicReservation(r));
}

/**
 * Full reservation detail including instructions, cancellation, PDF availability.
 * @param {string|number} userId
 * @param {string|number} reservationId
 */
async function getReservationDetail(userId, reservationId) {
  // Create the reservation constant.
  const reservation = await reservationSql.findByIdForUser(reservationId, userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Create the err constant.
    const err = new Error('Reservation not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Initialize the mutable order variable.
  let order = null;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in order.
    order = await orderSql.findOrderByReservationId(reservationId);
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Update order with the right-hand side value.
    order = null;
  }

  // Create the cancellation request constant.
  const cancellationRequest = await cancellationSql.findLatestForReservation(
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Reference the identifier used by the enclosing expression.
    userId
  );
  // Create the pickup checklist constant.
  const pickupChecklist = await pickupSql.findByReservationId(reservationId);
  // Create the return checklist constant.
  const returnChecklist = await returnSql.findByReservationId(reservationId);

  // Create the available pdfs constant.
  const availablePdfs = ['rental_agreement', 'invoice', 'receipt'];
  // Evaluate the condition and enter the branch when it is true.
  if (pickupChecklist) availablePdfs.push('pickup_checklist');
  // Evaluate the condition and enter the branch when it is true.
  if (returnChecklist) availablePdfs.push('return_checklist');
  // Idempotency guard: return early when work was already applied.
  if (returnChecklist?.newDamages || pickupChecklist?.existingDamages) {
    // Call availablePdfs.push to perform this step.
    availablePdfs.push('damage_report');
  }

  // Return the resulting value to the caller.
  return toPublicReservation(reservation, {
    // Provide the order id field value.
    orderId: order?.id || null,
    // Provide the pickup instructions field value.
    pickupInstructions: buildPickupInstructions(reservation),
    // Provide the return instructions field value.
    returnInstructions: buildReturnInstructions(reservation),
    // Contribute this line to the enclosing declaration or statement.
    cancellationRequest,
    // Provide the has pickup checklist field value.
    hasPickupChecklist: Boolean(pickupChecklist),
    // Provide the has return checklist field value.
    hasReturnChecklist: Boolean(returnChecklist),
    // Contribute this line to the enclosing declaration or statement.
    availablePdfs,
    // Provide the can request cancellation field value.
    canRequestCancellation:
      // Call HOLD_STATUSES.has to perform this step.
      HOLD_STATUSES.has(reservation.status) ||
      // Call REQUEST_CANCEL_STATUSES.has to perform this step.
      REQUEST_CANCEL_STATUSES.has(reservation.status),
  });
}

/**
 * Update flight/hotel travel fields on an owned reservation.
 */
async function updateTravel(userId, reservationId, travel) {
  // Create the updated constant.
  const updated = await reservationSql.updateTravelDetails(reservationId, userId, travel);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!updated) {
    // Create the err constant.
    const err = new Error('Reservation not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Return the resulting value to the caller.
  return toPublicReservation(updated);
}

/**
 * Cancel an unpaid hold immediately, or create a pending cancellation request for paid bookings.
 *
 * @param {import('express').Request} req
 * @param {string|number} userId
 * @param {string|number} reservationId
 * @param {string} [reason]
 */
async function requestCancellation(req, userId, reservationId, reason) {
  // Create the reservation constant.
  const reservation = await reservationSql.findByIdForUser(reservationId, userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Create the err constant.
    const err = new Error('Reservation not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Status / lifecycle guard before mutating domain state.
  if (isTerminal(reservation.status) && reservation.status !== 'cancelled') {
    // Create the err constant.
    const err = new Error('This reservation can no longer be cancelled.');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Status / lifecycle guard before mutating domain state.
  if (reservation.status === 'cancelled') {
    // Create the err constant.
    const err = new Error('Reservation is already cancelled.');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Unpaid holds: release immediately so the car becomes available again.
  if (HOLD_STATUSES.has(reservation.status)) {
    // Destructure object properties into local variables.
    const { reservation: updated } = await changeStatus({
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Provide the new status field value.
      newStatus: 'cancelled',
      // Provide the reason field value.
      reason: reason || 'customer_cancel_hold',
      // Provide the actor field value.
      actor: { type: 'customer', req, userId },
      // Provide the patch field value.
      patch: { holdExpiresAt: new Date() },
    });
    // Return the resulting value to the caller.
    return {
      // Provide the immediate field value.
      immediate: true,
      // Provide the reservation field value.
      reservation: toPublicReservation(updated),
      // Provide the cancellation request field value.
      cancellationRequest: null,
    };
  }

  // Status / lifecycle guard before mutating domain state.
  if (!REQUEST_CANCEL_STATUSES.has(reservation.status)) {
    // Create the err constant.
    const err = new Error(
      // Supply the literal value used by the enclosing expression.
      'Cancellation requests are not available for this reservation status. Please contact support.'
    );
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the existing constant.
  const existing = await cancellationSql.findPendingForReservation(reservationId);
  // Idempotency guard: return early when work was already applied.
  if (existing) {
    // Return the resulting value to the caller.
    return {
      // Provide the immediate field value.
      immediate: false,
      // Provide the reservation field value.
      reservation: toPublicReservation(reservation),
      // Provide the cancellation request field value.
      cancellationRequest: existing,
    };
  }

  // Protected block: isolate failure modes.
  try {
    // Create the cancellation request constant.
    const cancellationRequest = await cancellationSql.create({
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Contribute this line to the enclosing declaration or statement.
      userId,
      // Contribute this line to the enclosing declaration or statement.
      reason,
    });
    // Return the resulting value to the caller.
    return {
      // Provide the immediate field value.
      immediate: false,
      // Provide the reservation field value.
      reservation: toPublicReservation(reservation),
      // Contribute this line to the enclosing declaration or statement.
      cancellationRequest,
    };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Concurrent duplicate request — return the existing pending row.
    if (isUniqueViolation(err)) {
      // Create the pending constant.
      const pending = await cancellationSql.findPendingForReservation(reservationId);
      // Return the resulting value to the caller.
      return {
        // Provide the immediate field value.
        immediate: false,
        // Provide the reservation field value.
        reservation: toPublicReservation(reservation),
        // Provide the cancellation request field value.
        cancellationRequest: pending,
      };
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * Load reservation for PDF generation (owner or admin).
 */
async function getReservationForPdf(userId, reservationId, { admin = false } = {}) {
  // Evaluate the condition and enter the branch when it is true.
  if (admin) {
    // Create the reservation constant.
    const reservation = await reservationSql.findById(reservationId);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!reservation) {
      // Create the err constant.
      const err = new Error('Reservation not found');
      // Update err.code with the right-hand side value.
      err.code = 'NOT_FOUND';
      // Update err.status with the right-hand side value.
      err.status = 404;
      // Throw an error to stop the current control flow.
      throw err;
    }
    // Return the resulting value to the caller.
    return reservation;
  }
  // Create the reservation constant.
  const reservation = await reservationSql.findByIdForUser(reservationId, userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Create the err constant.
    const err = new Error('Reservation not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Return the resulting value to the caller.
  return reservation;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getDashboard,
  // Contribute this line to the enclosing declaration or statement.
  listReservations,
  // Contribute this line to the enclosing declaration or statement.
  getReservationDetail,
  // Contribute this line to the enclosing declaration or statement.
  updateTravel,
  // Contribute this line to the enclosing declaration or statement.
  requestCancellation,
  // Contribute this line to the enclosing declaration or statement.
  getReservationForPdf,
  // Contribute this line to the enclosing declaration or statement.
  toPublicReservation,
  // Contribute this line to the enclosing declaration or statement.
  paymentStatusLabel,
};
