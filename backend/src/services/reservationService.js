/**
 * Guest reservation holds: create/release/rehold, availability checks,
 * abandoned-hold cleanup, and reconcile of processing Stripe sessions whose holds expired.
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  HOLD_WINDOW_MS,
  // Contribute this line to the enclosing declaration or statement.
  getSessionId,
// Continue the surrounding logic with this statement.
} = require('../utils/reservationHelpers');
// Require the '../repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../repositories/reservationRepository');
// Require the './sql/sessionSqlService' module as sessionSql.
const sessionSql = require('./sql/sessionSqlService');
// Require the '../repositories/carRepository' module as carRepository.
const carRepository = require('../repositories/carRepository');
// Destructure object properties into local variables.
const { finalizeReservationByStripeSessionId } = require('./bookingFinalizationService');
// Destructure object properties into local variables.
const { changeStatus, recordInitialStatus } = require('./reservation/reservationStatusService');
// Destructure object properties into local variables.
const { logCustomerAction, logSystemAction } = require('./admin/adminAuditService');
// Destructure object properties into local variables.
const { retrieveStripeCheckoutSession } = require('./payment/stripeCheckoutService');
// Require the '../utils/logger' module as logger.
const logger = require('../utils/logger');
// Require the '../monitoring/logEvent' module as logEvent.
const logEvent = require('../monitoring/logEvent');
// Require the '../monitoring/metrics' module as metrics.
const metrics = require('../monitoring/metrics');

/** Active hold for the browse session cookie, if any. */
async function findActiveReservationBySession(req) {
  // Return the resulting value to the caller.
  return reservationRepository.findActiveBySessionId(getSessionId(req));
}

/**
 * Cancel the session's active hold (e.g. guest releases or checkout cancel).
 * @param {import('express').Request} req
 * @param {{ reason?: string, skipAudit?: boolean }} [options]
 */
async function releaseActiveReservationForSession(req, options = {}) {
  // Create the reason constant.
  const reason = options.reason || 'session_release';
  // Create the skip audit constant.
  const skipAudit = Boolean(options.skipAudit);
  // Create the reservation constant.
  const reservation = await findActiveReservationBySession(req);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Return the resulting value to the caller.
    return { cancelled: false, reservation: null };
  }

  // Destructure object properties into local variables.
  const { reservation: updated } = await changeStatus({
    // Provide the reservation id field value.
    reservationId: reservation.id,
    // Provide the new status field value.
    newStatus: 'cancelled',
    // Contribute this line to the enclosing declaration or statement.
    reason,
    // Provide the actor field value.
    actor: { type: 'customer', req, userId: req?.session?.user?.id },
    // Provide the patch field value.
    patch: { holdExpiresAt: new Date() },
  });

  // Call logEvent.info to perform this step.
  logEvent.info('reservation.cancelled', {
    // Provide the reservation id field value.
    reservationId: reservation.id?.toString?.(),
    // Contribute this line to the enclosing declaration or statement.
    reason,
  });

  // Guard: early-return or throw when required input is missing/invalid.
  if (!skipAudit) {
    // Create the action constant.
    const action =
      // Update reason with the right-hand side value.
      reason === 'checkout_cancel'
        // Contribute this line to the enclosing declaration or statement.
        ? 'customer.cancelled_checkout'
        // Contribute this line to the enclosing declaration or statement.
        : 'customer.released_hold';
    // Wait until the asynchronous operation resolves.
    await logCustomerAction(req, {
      // Contribute this line to the enclosing declaration or statement.
      action,
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: reservation.id,
      // Provide the metadata field value.
      metadata: { reason },
    });
  }

  // Return the resulting value to the caller.
  return { cancelled: true, reservation: updated };
}

/** Refresh hold TTL in memory (caller persists via changeStatus patch). */
function extendReservationHold(reservation) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Return the resulting value to the caller.
    return reservation;
  }

  // Update reservation.holdExpiresAt with the right-hand side value.
  reservation.holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_MS);
  // Return the resulting value to the caller.
  return reservation;
}

/**
 * Check holds, open physical rentals, and booked calendar overlaps for a range.
 * @returns {Promise<{ overlappingReservation: *, openPhysicalRental: *, bookedOverlap: * }>}
 */
async function checkCarAvailabilityForRange({
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  startDate,
  // Contribute this line to the enclosing declaration or statement.
  endDate,
  // Update now with the right-hand side value.
  now = new Date(),
// Continue the surrounding logic with this statement.
}) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId || !(startDate instanceof Date) || !(endDate instanceof Date)) {
    // Throw an error to stop the current control flow.
    throw new Error('checkCarAvailabilityForRange: invalid arguments');
  }

  // Create the overlapping reservation constant.
  const overlappingReservation = await reservationRepository.findOverlappingHold({
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
    // Contribute this line to the enclosing declaration or statement.
    now,
  });
  // Create the open physical rental constant.
  const openPhysicalRental = await reservationRepository.findOpenPhysicalRental(carId);
  // Create the booked overlap constant.
  const bookedOverlap = await reservationRepository.findBookedDateOverlap(
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Reference the identifier used by the enclosing expression.
    endDate
  );

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    overlappingReservation,
    // Contribute this line to the enclosing declaration or statement.
    openPhysicalRental,
    // Contribute this line to the enclosing declaration or statement.
    bookedOverlap,
  };
}

/**
 * Create a pending_payment hold with availability check; records initial status history.
 * @param {object} payload
 * @param {import('express').Request|null} [req]
 */
async function createPendingReservation(payload, req = null) {
  // Create the user id constant.
  const userId = req?.session?.user?.id ?? null;
  // Create the result constant.
  const result = await reservationRepository.createWithAvailabilityCheck({
    // Spread payload into the surrounding structure.
    ...payload,
    // Contribute this line to the enclosing declaration or statement.
    userId,
  });
  // Create the created constant.
  const created = result?.existingActiveReservation ? null : result?.reservation || null;

  // Evaluate the condition and enter the branch when it is true.
  if (created) {
    // Wait until the asynchronous operation resolves.
    await recordInitialStatus({
      // Provide the reservation id field value.
      reservationId: created.id,
      // Provide the status field value.
      status: 'pending_payment',
      // Provide the reason field value.
      reason: 'created',
      // Provide the actor field value.
      actor: { type: 'customer', req, userId: req?.session?.user?.id },
      // Provide the metadata field value.
      metadata: {
        // Provide the car id field value.
        carId: payload?.carId,
        // Provide the session id field value.
        sessionId: payload?.sessionId,
      },
    });

    // Call logEvent.info to perform this step.
    logEvent.info('reservation.created', {
      // Provide the reservation id field value.
      reservationId: created.id?.toString?.(),
      // Provide the car id field value.
      carId: payload?.carId?.toString?.(),
      // Provide the session id field value.
      sessionId: payload?.sessionId,
    });

    // Evaluate the condition and enter the branch when it is true.
    if (req) {
      // Wait until the asynchronous operation resolves.
      await logCustomerAction(req, {
        // Provide the action field value.
        action: 'customer.created_hold',
        // Provide the entity type field value.
        entityType: 'reservation',
        // Provide the entity id field value.
        entityId: created.id,
        // Provide the metadata field value.
        metadata: {
          // Provide the car id field value.
          carId: payload?.carId,
          // Provide the session id field value.
          sessionId: payload?.sessionId,
          // Provide the from field value.
          from:
            // Contribute this line to the enclosing declaration or statement.
            payload?.startDate instanceof Date
              // Continue the surrounding logic with this statement.
              ? payload.startDate.toISOString()
              // Contribute this line to the enclosing declaration or statement.
              : payload?.startDate,
          // Provide the to field value.
          to:
            // Contribute this line to the enclosing declaration or statement.
            payload?.endDate instanceof Date
              // Continue the surrounding logic with this statement.
              ? payload.endDate.toISOString()
              // Contribute this line to the enclosing declaration or statement.
              : payload?.endDate,
        },
      });
    }
  }

  // Return the resulting value to the caller.
  return result;
}

/**
 * attach car name to reservation.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function attachCarNameToReservation(reservation) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Return the resulting value to the caller.
    return reservation;
  }

  // Create the raw car id constant.
  const rawCarId =
    // Continue the surrounding logic with this statement.
    reservation.carId && typeof reservation.carId === 'object'
      // Contribute this line to the enclosing declaration or statement.
      ? reservation.carId.id
      // Contribute this line to the enclosing declaration or statement.
      : reservation.carId;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!rawCarId) {
    // Return the resulting value to the caller.
    return reservation;
  }

  // Create the car constant.
  const car = await carRepository.findById(rawCarId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car) {
    // Return the resulting value to the caller.
    return reservation;
  }

  // Return the resulting value to the caller.
  return {
    // Spread reservation into the surrounding structure.
    ...reservation,
    // Provide the car id field value.
    carId: { id: car.id, name: car.name },
  };
}

/**
 * For processing holds past TTL: finalize if Stripe paid, expire if session expired,
 * keep if Checkout is still open.
 * @param {Date} [now]
 */
async function reconcileProcessingStripeReservations(now = new Date()) {
  // Create the candidates constant.
  const candidates = await reservationRepository.findProcessingWithExpiredHold(now);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!candidates.length) {
    // Return the resulting value to the caller.
    return { checked: 0, expired: 0, finalized: 0, kept: 0 };
  }

  // Initialize the mutable expired variable.
  let expired = 0;
  // Initialize the mutable finalized variable.
  let finalized = 0;
  // Initialize the mutable kept variable.
  let kept = 0;

  // Iterate using the loop initializer, condition, and step.
  for (const reservation of candidates) {
    // Create the stripe session id constant.
    const stripeSessionId = reservation.stripeSessionId;
    // Stripe / payment-related branch.
    if (!stripeSessionId) {
      // Continue with the next loop iteration.
      continue;
    }

    // Protected block: isolate failure modes.
    try {
      // Create the session constant.
      const session = await retrieveStripeCheckoutSession(stripeSessionId);

      // Evaluate the condition and enter the branch when it is true.
      if (session.payment_status === 'paid') {
        // Create the result constant.
        const result = await finalizeReservationByStripeSessionId(stripeSessionId, {
          // Provide the reservation id field value.
          reservationId: reservation.id,
          // Provide the car id field value.
          carId: reservation.carId?.id || reservation.carId,
          // Provide the session id field value.
          sessionId: reservation.sessionId,
          // Provide the stripe session payment status field value.
          stripeSessionPaymentStatus: session.payment_status,
          // Provide the stripe session amount total field value.
          stripeSessionAmountTotal: session.amount_total ?? null,
          // Provide the stripe session currency field value.
          stripeSessionCurrency: session.currency || null,
          // Provide the log prefix field value.
          logPrefix: '[CleanupStripeReconcile]',
        });

        // Evaluate the condition and enter the branch when it is true.
        if (result.finalized || result.reason === 'already_confirmed') {
          // Update finalized with the right-hand side value.
          finalized += 1;
        }
        // Continue with the next loop iteration.
        continue;
      }

      // Evaluate the condition and enter the branch when it is true.
      if (session.status === 'open') {
        // Update kept with the right-hand side value.
        kept += 1;
        // Continue with the next loop iteration.
        continue;
      }

      // Evaluate the condition and enter the branch when it is true.
      if (session.status === 'expired' && session.payment_status !== 'paid') {
        // Start a try block for operations that may fail.
        try {
          // Wait until the asynchronous operation resolves.
          await changeStatus({
            // Provide the reservation id field value.
            reservationId: reservation.id,
            // Provide the new status field value.
            newStatus: 'expired',
            // Provide the reason field value.
            reason: 'stripe_session_expired',
            // Provide the actor field value.
            actor: { type: 'system' },
            // Provide the patch field value.
            patch: { holdExpiresAt: now },
          });
          // Update expired with the right-hand side value.
          expired += 1;
        // Continue the surrounding logic with this statement.
        } catch (statusErr) {
          // Evaluate the condition and enter the branch when it is true.
          if (statusErr.code !== 'INVALID_STATUS_TRANSITION') {
            // Throw an error to stop the current control flow.
            throw statusErr;
          }
        }
      }
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call logger.error to perform this step.
      logger.error(
        {
          // Contribute this line to the enclosing declaration or statement.
          err,
          // Provide the reservation id field value.
          reservationId: reservation.id,
          // Contribute this line to the enclosing declaration or statement.
          stripeSessionId,
          // Provide the context field value.
          context: 'reconcileProcessingStripeReservations',
        },
        // Supply the literal value used by the enclosing expression.
        'Stripe checkout reconcile failed during cleanup'
      );
    }
  }

  // Return the resulting value to the caller.
  return { checked: candidates.length, expired, finalized, kept };
}

/**
 * Job: expire holds whose browse sessions died, then reconcile Stripe processing holds.
 */
async function cleanUpAbandonedReservations() {
  // Protected block: isolate failure modes.
  try {
    // Create the now utc constant.
    const nowUTC = new Date();
    // Create the active sids constant.
    const activeSids = await sessionSql.listActiveSessionIds();
    // Create the abandoned constant.
    const abandoned = await reservationRepository.markAbandoned(activeSids, nowUTC);
    // Create the modified count constant.
    const modifiedCount =
      // Continue the surrounding logic with this statement.
      typeof abandoned === 'number' ? abandoned : abandoned?.count || 0;
    // Create the expired ids constant.
    const expiredIds =
      // Continue the surrounding logic with this statement.
      typeof abandoned === 'object' && Array.isArray(abandoned?.reservationIds)
        // Contribute this line to the enclosing declaration or statement.
        ? abandoned.reservationIds
        // Contribute this line to the enclosing declaration or statement.
        : [];

    // Evaluate the condition and enter the branch when it is true.
    if (modifiedCount) {
      // Call logger.info to perform this step.
      logger.info({ modifiedCount }, 'Marked reservations as expired or abandoned');
      // Call logEvent.info to perform this step.
      logEvent.info('checkout.abandoned', { count: modifiedCount });
      // Call metrics.incrementCheckoutAbandoned to perform this step.
      metrics.incrementCheckoutAbandoned(modifiedCount);
      // Wait until the asynchronous operation resolves.
      await logSystemAction({
        // Provide the action field value.
        action: 'system.abandoned_reservations',
        // Provide the entity type field value.
        entityType: 'reservation',
        // Provide the metadata field value.
        metadata: { count: modifiedCount },
      });

      // SQL expiry bypasses status listeners — publish payment_failed for ops.
      try {
        // Destructure object properties into local variables.
        const { publishPaymentFailed } = require('../modules/realtime/realtime.publisher');
        // Iterate using the loop initializer, condition, and step.
        for (const reservationId of expiredIds) {
          // Call publishPaymentFailed to perform this step.
          publishPaymentFailed({
            // Contribute this line to the enclosing declaration or statement.
            reservationId,
            // Provide the status field value.
            status: 'expired',
            // Provide the reason field value.
            reason: 'abandoned_hold',
          });
        }
      // Continue the surrounding logic with this statement.
      } catch (liveErr) {
        // Call logger.error to perform this step.
        logger.error(
          // Contribute this line to the enclosing declaration or statement.
          { err: liveErr, context: 'cleanUpAbandonedReservations' },
          // Supply the literal value used by the enclosing expression.
          'Abandoned hold live event hook error'
        );
      }
    }

    // Create the stripe reconcile constant.
    const stripeReconcile = await reconcileProcessingStripeReservations(nowUTC);
    // Stripe / payment-related branch.
    if (stripeReconcile.finalized || stripeReconcile.expired) {
      // Call logger.info to perform this step.
      logger.info(stripeReconcile, 'Reconciled processing Stripe checkout reservations');
    }
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'cleanUpAbandonedReservations' }, 'Cleanup error (abandoned reservations)');
  }
}

/**
 * publish rehold side effects.
 * @param {*} result
 * @returns {*}
 */
function publishReholdSideEffects(result) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!result?.ok || !result.reservation) {
    // Return control to the caller with the following value.
    return;
  }

  // Protected block: isolate failure modes.
  try {
    // Destructure object properties into local variables.
    const {
      // Contribute this line to the enclosing declaration or statement.
      publishLiveEvent,
      // Contribute this line to the enclosing declaration or statement.
      publishCalendarUpdated,
    // Continue the surrounding logic with this statement.
    } = require('../modules/realtime/realtime.publisher');
    // Create the car id constant.
    const carId =
      // Contribute this line to the enclosing declaration or statement.
      result.reservation.carId?.id || result.reservation.carId || result.historyMetadata?.toCarId;
    // Call publishLiveEvent to perform this step.
    publishLiveEvent('reservation_updated', {
      // Provide the reservation id field value.
      reservationId: result.reservation.id,
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: result.reservation.status,
      // Provide the old status field value.
      oldStatus: 'pending_payment',
      // Provide the meta field value.
      meta: result.historyMetadata || {},
    });
    // Call publishCalendarUpdated to perform this step.
    publishCalendarUpdated({
      // Provide the action field value.
      action: 'customer_reheld',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: result.reservation.id,
      // Provide the meta field value.
      meta: result.historyMetadata || {},
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'publishReholdSideEffects' }, 'Rehold live event hook error');
  }
}

/**
 * Atomically release the current session hold and create a new one (car/date change).
 */
async function releaseAndReholdForSession(req, {
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  startDate,
  // Contribute this line to the enclosing declaration or statement.
  endDate,
  // Contribute this line to the enclosing declaration or statement.
  pickupTime,
  // Contribute this line to the enclosing declaration or statement.
  returnTime,
  // Contribute this line to the enclosing declaration or statement.
  pickupLocation,
  // Contribute this line to the enclosing declaration or statement.
  returnLocation,
  // Contribute this line to the enclosing declaration or statement.
  pricing,
// Continue the surrounding logic with this statement.
}) {
  // Create the session id constant.
  const sessionId = getSessionId(req);

  // Create the result constant.
  const result = await reservationRepository.reholdWithAvailabilityCheck({
    // Contribute this line to the enclosing declaration or statement.
    sessionId,
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
    // Contribute this line to the enclosing declaration or statement.
    pickupTime,
    // Contribute this line to the enclosing declaration or statement.
    returnTime,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    // Contribute this line to the enclosing declaration or statement.
    pricing,
  });

  // Evaluate the condition and enter the branch when it is true.
  if (result.ok) {
    // Call logEvent.info to perform this step.
    logEvent.info('reservation.reheld', {
      // Provide the reservation id field value.
      reservationId: result.reservation?.id?.toString?.(),
      // Provide the from car id field value.
      fromCarId: result.fromCarId,
      // Provide the to car id field value.
      toCarId: carId?.toString?.() || carId,
      // Contribute this line to the enclosing declaration or statement.
      sessionId,
    });
    // Call publishReholdSideEffects to perform this step.
    publishReholdSideEffects(result);
  }

  // Return the resulting value to the caller.
  return result;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  findActiveReservationBySession,
  // Contribute this line to the enclosing declaration or statement.
  releaseActiveReservationForSession,
  // Contribute this line to the enclosing declaration or statement.
  releaseAndReholdForSession,
  // Contribute this line to the enclosing declaration or statement.
  extendReservationHold,
  // Contribute this line to the enclosing declaration or statement.
  attachCarNameToReservation,
  // Contribute this line to the enclosing declaration or statement.
  checkCarAvailabilityForRange,
  // Contribute this line to the enclosing declaration or statement.
  createPendingReservation,
  // Contribute this line to the enclosing declaration or statement.
  cleanUpAbandonedReservations,
  // Contribute this line to the enclosing declaration or statement.
  reconcileProcessingStripeReservations,
};
