/**
 * My Account reservation APIs: dashboard, list/detail, travel updates,
 * cancellation (immediate for unpaid holds; request queue for paid bookings).
 */
const reservationSql = require('../sql/reservationSqlService');
const orderSql = require('../sql/orderSqlService');
const cancellationSql = require('../sql/cancellationRequestSqlService');
const pickupSql = require('../sql/pickupChecklistSqlService');
const returnSql = require('../sql/returnChecklistSqlService');
const { changeStatus } = require('../reservation/reservationStatusService');
const {
  buildPickupInstructions,
  buildReturnInstructions,
} = require('./instructionsService');
const { isTerminal } = require('../../domain/reservationStatus');
const { isUniqueViolation } = require('../../db/transaction');

/** Unpaid hold statuses — customer may cancel immediately without admin review. */
const HOLD_STATUSES = new Set(['pending_payment', 'processing_payment']);
/** Paid/ops statuses that require a cancellation request for staff approval. */
const REQUEST_CANCEL_STATUSES = new Set([
  'paid',
  'confirmed',
  'car_prepared',
  'manual_review',
]);

const PAYMENT_PAID_STATUSES = new Set([
  'paid',
  'confirmed',
  'car_prepared',
  'picked_up',
  'active_rental',
  'returned',
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
  return status;
}

/**
 * Map a reservation row to the public account DTO.
 * @param {object} reservation
 * @param {object} [extras]
 * @returns {object}
 */
function toPublicReservation(reservation, extras = {}) {
  const carName =
    reservation.carId && typeof reservation.carId === 'object'
      ? reservation.carId.name
      : extras.carName;

  return {
    id: reservation.id,
    status: reservation.status,
    paymentStatus: paymentStatusLabel(reservation.status),
    carId:
      reservation.carId && typeof reservation.carId === 'object'
        ? reservation.carId.id
        : reservation.carId,
    carName: carName || null,
    pickupDate: reservation.pickupDate,
    pickupTime: reservation.pickupTime || null,
    returnDate: reservation.returnDate,
    returnTime: reservation.returnTime || null,
    pickupLocation: reservation.pickupLocation,
    returnLocation: reservation.returnLocation,
    rentalDays: reservation.rentalDays,
    totalPrice: reservation.totalPrice,
    deposit: reservation.deposit,
    fullName: reservation.fullName || null,
    email: reservation.email || null,
    phoneNumber: reservation.phoneNumber || null,
    address: reservation.address || null,
    hotelName: reservation.hotelName || null,
    flightNumber: reservation.flightNumber || null,
    specialRequests: reservation.specialRequests || null,
    selectedExtras: reservation.selectedExtras || [],
    hotelDelivery: Boolean(reservation.hotelDelivery),
    createdAt: reservation.createdAt,
    ...extras,
  };
}

/**
 * @param {string|number} userId
 * @returns {Promise<object>}
 */
async function getDashboard(userId) {
  const reservations = await reservationSql.listByUserId(userId, { limit: 100 });
  const upcoming = reservations.find((r) =>
    ['confirmed', 'car_prepared', 'paid', 'picked_up', 'active_rental'].includes(r.status)
  );
  const activeCount = reservations.filter((r) =>
    ['confirmed', 'car_prepared', 'picked_up', 'active_rental', 'paid'].includes(r.status)
  ).length;
  const completedCount = reservations.filter((r) => r.status === 'completed').length;

  return {
    counts: {
      total: reservations.length,
      active: activeCount,
      completed: completedCount,
    },
    upcoming: upcoming ? toPublicReservation(upcoming) : null,
    recent: reservations.slice(0, 5).map((r) => toPublicReservation(r)),
  };
}

/**
 * @param {string|number} userId
 * @returns {Promise<object[]>}
 */
async function listReservations(userId) {
  const reservations = await reservationSql.listByUserId(userId, { limit: 100 });
  return reservations.map((r) => toPublicReservation(r));
}

/**
 * Full reservation detail including instructions, cancellation, PDF availability.
 * @param {string|number} userId
 * @param {string|number} reservationId
 */
async function getReservationDetail(userId, reservationId) {
  const reservation = await reservationSql.findByIdForUser(reservationId, userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  let order = null;
  // Protected block: isolate failure modes.
  try {
    order = await orderSql.findOrderByReservationId(reservationId);
  } catch {
    order = null;
  }

  const cancellationRequest = await cancellationSql.findLatestForReservation(
    reservationId,
    userId
  );
  const pickupChecklist = await pickupSql.findByReservationId(reservationId);
  const returnChecklist = await returnSql.findByReservationId(reservationId);

  const availablePdfs = ['rental_agreement', 'invoice', 'receipt'];
  if (pickupChecklist) availablePdfs.push('pickup_checklist');
  if (returnChecklist) availablePdfs.push('return_checklist');
  // Idempotency guard: return early when work was already applied.
  if (returnChecklist?.newDamages || pickupChecklist?.existingDamages) {
    availablePdfs.push('damage_report');
  }

  return toPublicReservation(reservation, {
    orderId: order?.id || null,
    pickupInstructions: buildPickupInstructions(reservation),
    returnInstructions: buildReturnInstructions(reservation),
    cancellationRequest,
    hasPickupChecklist: Boolean(pickupChecklist),
    hasReturnChecklist: Boolean(returnChecklist),
    availablePdfs,
    canRequestCancellation:
      HOLD_STATUSES.has(reservation.status) ||
      REQUEST_CANCEL_STATUSES.has(reservation.status),
  });
}

/**
 * Update flight/hotel travel fields on an owned reservation.
 */
async function updateTravel(userId, reservationId, travel) {
  const updated = await reservationSql.updateTravelDetails(reservationId, userId, travel);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!updated) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
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
  const reservation = await reservationSql.findByIdForUser(reservationId, userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Status / lifecycle guard before mutating domain state.
  if (isTerminal(reservation.status) && reservation.status !== 'cancelled') {
    const err = new Error('This reservation can no longer be cancelled.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  // Status / lifecycle guard before mutating domain state.
  if (reservation.status === 'cancelled') {
    const err = new Error('Reservation is already cancelled.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  // Unpaid holds: release immediately so the car becomes available again.
  if (HOLD_STATUSES.has(reservation.status)) {
    const { reservation: updated } = await changeStatus({
      reservationId,
      newStatus: 'cancelled',
      reason: reason || 'customer_cancel_hold',
      actor: { type: 'customer', req, userId },
      patch: { holdExpiresAt: new Date() },
    });
    return {
      immediate: true,
      reservation: toPublicReservation(updated),
      cancellationRequest: null,
    };
  }

  // Status / lifecycle guard before mutating domain state.
  if (!REQUEST_CANCEL_STATUSES.has(reservation.status)) {
    const err = new Error(
      'Cancellation requests are not available for this reservation status. Please contact support.'
    );
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  const existing = await cancellationSql.findPendingForReservation(reservationId);
  // Idempotency guard: return early when work was already applied.
  if (existing) {
    return {
      immediate: false,
      reservation: toPublicReservation(reservation),
      cancellationRequest: existing,
    };
  }

  // Protected block: isolate failure modes.
  try {
    const cancellationRequest = await cancellationSql.create({
      reservationId,
      userId,
      reason,
    });
    return {
      immediate: false,
      reservation: toPublicReservation(reservation),
      cancellationRequest,
    };
  } catch (err) {
    // Concurrent duplicate request — return the existing pending row.
    if (isUniqueViolation(err)) {
      const pending = await cancellationSql.findPendingForReservation(reservationId);
      return {
        immediate: false,
        reservation: toPublicReservation(reservation),
        cancellationRequest: pending,
      };
    }
    throw err;
  }
}

/**
 * Load reservation for PDF generation (owner or admin).
 */
async function getReservationForPdf(userId, reservationId, { admin = false } = {}) {
  if (admin) {
    const reservation = await reservationSql.findById(reservationId);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!reservation) {
      const err = new Error('Reservation not found');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }
    return reservation;
  }
  const reservation = await reservationSql.findByIdForUser(reservationId, userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return reservation;
}

module.exports = {
  getDashboard,
  listReservations,
  getReservationDetail,
  updateTravel,
  requestCancellation,
  getReservationForPdf,
  toPublicReservation,
  paymentStatusLabel,
};
