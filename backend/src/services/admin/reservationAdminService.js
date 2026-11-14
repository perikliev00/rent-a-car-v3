/**
 * Admin reservation status ops: manual-review confirmation, allowed status
 * transitions, and detail + history for the ops console.
 */
const orderSql = require('../sql/orderSqlService');
const { addRange } = require('../sql/bookingSyncSqlService');
const {
  changeStatus,
} = require('../reservation/reservationStatusService');
const { ADMIN_OPS_STATUSES, isValidStatus } = require('../../domain/reservationStatus');
const historySql = require('../sql/reservationStatusHistorySqlService');
const reservationRepository = require('../../repositories/reservationRepository');
const { runWithTransaction, acquireCarAdvisoryLocks } = require('../../db/transaction');
const carRepository = require('../../repositories/carRepository');
const { sendBookingConfirmationEmails } = require('../email/bookingEmailService');
const {
  assertNoActiveReservationHold,
  assertNoOpenPhysicalRental,
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
  const result = await runWithTransaction(async (client) => {
    const carId = reservation.carId?.id || reservation.carId;

    await acquireCarAdvisoryLocks(client, [carId]);
    try {
      await assertNoActiveReservationHold(
        carId,
        reservation.pickupDate,
        reservation.returnDate,
        client
      );
      await assertNoOpenPhysicalRental(carId, client, {
        excludeReservationId: reservation.id,
      });
    } catch (err) {
      if (err.isOrderFormError) {
        const mapped = new Error(err.message);
        mapped.code = 'VALIDATION_ERROR';
        mapped.status = 422;
        throw mapped;
      }
      throw err;
    }

    await addRange(carId, reservation.pickupDate, reservation.returnDate, client);

    // Synthetic stripeSessionId when admin confirms without a Checkout session.
    const order = await orderSql.createOrderFromReservation(
      {
        ...reservation,
        stripeSessionId:
          reservation.stripeSessionId || `admin-confirm-${reservation.id}`,
      },
      carId,
      client
    );

    const { reservation: updated } = await changeStatus({
      reservationId: reservation.id,
      newStatus: 'confirmed',
      reason: reason || 'admin_manual_review_confirm',
      actor: {
        type: 'admin',
        req,
        userId: req?.session?.user?.id ?? null,
      },
      metadata: { source: 'admin_api', orderId: order.id },
      client,
    });

    return {
      reservation: updated,
      changed: true,
      oldStatus: 'manual_review',
      newStatus: 'confirmed',
      order,
    };
  });

  let carName = null;
  try {
    const carId = reservation.carId?.id || reservation.carId;
    const car = await carRepository.findById(carId);
    carName = car?.name || null;
  } catch {
    carName = null;
  }
  await sendBookingConfirmationEmails({
    order: result.order,
    reservation: result.reservation,
    carName,
  });

  return result;
}

/**
 * Change reservation status via admin ops (whitelist + refund guard).
 * @param {import('express').Request} req
 * @param {{reservationId: number|string, status: string, reason?: string}} params
 */
async function changeReservationStatus(req, { reservationId, status, reason }) {
  // Status / lifecycle guard before mutating domain state.
  if (!isValidStatus(status)) {
    const err = new Error('Invalid reservation status');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  // Status / lifecycle guard before mutating domain state.
  if (!ADMIN_OPS_STATUSES.includes(status)) {
    const err = new Error('Status is not allowed for admin ops transitions');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  // Refunds must go through POST /api/admin/reservations/:id/refund (Stripe money movement).
  if (status === 'refunded') {
    const err = new Error(
      'Use POST /api/admin/reservations/:id/refund to refund. Status-only refunds are not allowed.'
    );
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  const existing = await reservationRepository.findById(reservationId);
  // Idempotency guard: return early when work was already applied.
  if (!existing) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Idempotency guard: return early when work was already applied.
  if (existing.status === 'manual_review' && status === 'confirmed') {
    return confirmManualReviewReservation(req, existing, reason);
  }

  // Opening a physical rental must serialize on the car and refuse a second open rental.
  if (
    (status === 'picked_up' || status === 'active_rental') &&
    existing.status !== status
  ) {
    const carId = existing.carId?.id || existing.carId;
    return runWithTransaction(async (client) => {
      if (carId) {
        await acquireCarAdvisoryLocks(client, [carId]);
        try {
          await assertNoOpenPhysicalRental(carId, client, {
            excludeReservationId: reservationId,
          });
        } catch (err) {
          if (err.isOrderFormError) {
            const mapped = new Error(err.message);
            mapped.code = 'OPEN_PHYSICAL_RENTAL';
            mapped.status = 409;
            throw mapped;
          }
          throw err;
        }
      }

      return changeStatus({
        reservationId,
        newStatus: status,
        reason: reason || 'admin_status_change',
        actor: {
          type: 'admin',
          req,
          userId: req?.session?.user?.id ?? null,
        },
        metadata: { source: 'admin_api' },
        client,
      });
    });
  }

  const result = await changeStatus({
    reservationId,
    newStatus: status,
    reason: reason || 'admin_status_change',
    actor: {
      type: 'admin',
      req,
      userId: req?.session?.user?.id ?? null,
    },
    metadata: { source: 'admin_api' },
  });

  return result;
}

/**
 * Reservation detail with recent status history for the admin drawer.
 * @param {number|string} reservationId
 */
async function getReservationDetail(reservationId) {
  const reservation = await reservationRepository.findById(reservationId);
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const history = await historySql.listHistoryForReservation(reservationId, { limit: 50 });
  return { reservation, history };
}

module.exports = {
  changeReservationStatus,
  getReservationDetail,
  ADMIN_OPS_STATUSES,
};
