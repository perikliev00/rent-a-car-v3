/**
 * Admin reservation status ops: manual-review confirmation, allowed status
 * transitions, and detail + history for the ops console.
 */
const orderSql = require('../sql/orderSqlService');
// Destructure object properties into local variables.
const { addRange } = require('../sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  changeStatus,
// Continue the surrounding logic with this statement.
} = require('../reservation/reservationStatusService');
// Destructure object properties into local variables.
const { ADMIN_OPS_STATUSES, isValidStatus } = require('../../domain/reservationStatus');
// Require the '../sql/reservationStatusHistorySqlService' module as historySql.
const historySql = require('../sql/reservationStatusHistorySqlService');
// Require the '../../repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../../repositories/reservationRepository');
// Destructure object properties into local variables.
const { runWithTransaction, acquireCarAdvisoryLocks } = require('../../db/transaction');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  assertNoActiveReservationHold,
  // Contribute this line to the enclosing declaration or statement.
  assertNoOpenPhysicalRental,
// Continue the surrounding logic with this statement.
} = require('./order/orderConflictService');

/**
 * Promote manual_review → confirmed: lock the car, check holds/rentals,
 * block calendar range, create the order, then change status.
 * Advisory locks prevent concurrent confirmations double-booking the car.
 * @param {import('express').Request} req
 * @param {object} reservation
 * @param {string} [reason]
 */
async function confirmManualReviewReservation(req, reservation, reason) {
  // Return the resulting value to the caller.
  return runWithTransaction(async (client) => {
    // Create the car id constant.
    const carId = reservation.carId?.id || reservation.carId;

    // Wait until the asynchronous operation resolves.
    await acquireCarAdvisoryLocks(client, [carId]);
    // Protected block: isolate failure modes.
    try {
      // Wait until the asynchronous operation resolves.
      await assertNoActiveReservationHold(
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        reservation.pickupDate,
        // Contribute this line to the enclosing declaration or statement.
        reservation.returnDate,
        // Reference the identifier used by the enclosing expression.
        client
      );
      // Wait until the asynchronous operation resolves.
      await assertNoOpenPhysicalRental(carId, client, {
        // Provide the exclude reservation id field value.
        excludeReservationId: reservation.id,
      });
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Evaluate the condition and enter the branch when it is true.
      if (err.isOrderFormError) {
        // Create the mapped constant.
        const mapped = new Error(err.message);
        // Update mapped.code with the right-hand side value.
        mapped.code = 'VALIDATION_ERROR';
        // Update mapped.status with the right-hand side value.
        mapped.status = 422;
        // Throw an error to stop the current control flow.
        throw mapped;
      }
      // Throw an error to stop the current control flow.
      throw err;
    }

    // Wait until the asynchronous operation resolves.
    await addRange(carId, reservation.pickupDate, reservation.returnDate, client);

    // Synthetic stripeSessionId when admin confirms without a Checkout session.
    const order = await orderSql.createOrderFromReservation(
      {
        // Spread reservation into the surrounding structure.
        ...reservation,
        // Provide the stripe session id field value.
        stripeSessionId:
          // Continue the surrounding logic with this statement.
          reservation.stripeSessionId || `admin-confirm-${reservation.id}`,
      },
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Reference the identifier used by the enclosing expression.
      client
    );

    // Destructure object properties into local variables.
    const { reservation: updated } = await changeStatus({
      // Provide the reservation id field value.
      reservationId: reservation.id,
      // Provide the new status field value.
      newStatus: 'confirmed',
      // Provide the reason field value.
      reason: reason || 'admin_manual_review_confirm',
      // Provide the actor field value.
      actor: {
        // Provide the type field value.
        type: 'admin',
        // Contribute this line to the enclosing declaration or statement.
        req,
        // Provide the user id field value.
        userId: req?.session?.user?.id ?? null,
      },
      // Provide the metadata field value.
      metadata: { source: 'admin_api', orderId: order.id },
      // Contribute this line to the enclosing declaration or statement.
      client,
    });

    // Return the resulting value to the caller.
    return {
      // Provide the reservation field value.
      reservation: updated,
      // Provide the changed field value.
      changed: true,
      // Provide the old status field value.
      oldStatus: 'manual_review',
      // Provide the new status field value.
      newStatus: 'confirmed',
      // Contribute this line to the enclosing declaration or statement.
      order,
    };
  });
}

/**
 * Change reservation status via admin ops (whitelist + refund guard).
 * @param {import('express').Request} req
 * @param {{reservationId: number|string, status: string, reason?: string}} params
 */
async function changeReservationStatus(req, { reservationId, status, reason }) {
  // Status / lifecycle guard before mutating domain state.
  if (!isValidStatus(status)) {
    // Create the err constant.
    const err = new Error('Invalid reservation status');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Status / lifecycle guard before mutating domain state.
  if (!ADMIN_OPS_STATUSES.includes(status)) {
    // Create the err constant.
    const err = new Error('Status is not allowed for admin ops transitions');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Refunds must go through POST /api/admin/reservations/:id/refund (Stripe money movement).
  if (status === 'refunded') {
    // Create the err constant.
    const err = new Error(
      // Supply the literal value used by the enclosing expression.
      'Use POST /api/admin/reservations/:id/refund to refund. Status-only refunds are not allowed.'
    );
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the existing constant.
  const existing = await reservationRepository.findById(reservationId);
  // Idempotency guard: return early when work was already applied.
  if (!existing) {
    // Create the err constant.
    const err = new Error('Reservation not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Idempotency guard: return early when work was already applied.
  if (existing.status === 'manual_review' && status === 'confirmed') {
    // Return the resulting value to the caller.
    return confirmManualReviewReservation(req, existing, reason);
  }

  // Create the result constant.
  const result = await changeStatus({
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Provide the new status field value.
    newStatus: status,
    // Provide the reason field value.
    reason: reason || 'admin_status_change',
    // Provide the actor field value.
    actor: {
      // Provide the type field value.
      type: 'admin',
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Provide the user id field value.
      userId: req?.session?.user?.id ?? null,
    },
    // Provide the metadata field value.
    metadata: { source: 'admin_api' },
  });

  // Return the resulting value to the caller.
  return result;
}

/**
 * Reservation detail with recent status history for the admin drawer.
 * @param {number|string} reservationId
 */
async function getReservationDetail(reservationId) {
  // Create the reservation constant.
  const reservation = await reservationRepository.findById(reservationId);
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

  // Create the history constant.
  const history = await historySql.listHistoryForReservation(reservationId, { limit: 50 });
  // Return the resulting value to the caller.
  return { reservation, history };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  changeReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  getReservationDetail,
  // Contribute this line to the enclosing declaration or statement.
  ADMIN_OPS_STATUSES,
};
