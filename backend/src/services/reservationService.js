/**
 * Guest reservation holds: create/release/rehold, availability checks,
 * abandoned-hold cleanup, and reconcile of processing Stripe sessions whose holds expired.
 */
const {
  HOLD_WINDOW_MS,
  getSessionId,
} = require('../utils/reservationHelpers');
const reservationRepository = require('../repositories/reservationRepository');
const sessionSql = require('./sql/sessionSqlService');
const carRepository = require('../repositories/carRepository');
const { finalizeReservationByStripeSessionId } = require('./bookingFinalizationService');
const { changeStatus, recordInitialStatus } = require('./reservation/reservationStatusService');
const { logCustomerAction, logSystemAction } = require('./admin/adminAuditService');
const { retrieveStripeCheckoutSession } = require('./payment/stripeCheckoutService');
const logger = require('../utils/logger');
const logEvent = require('../monitoring/logEvent');
const metrics = require('../monitoring/metrics');

/** Active hold for the browse session cookie, if any. */
async function findActiveReservationBySession(req) {
  return reservationRepository.findActiveBySessionId(getSessionId(req));
}

/**
 * Cancel the session's active hold (e.g. guest releases or checkout cancel).
 * @param {import('express').Request} req
 * @param {{ reason?: string, skipAudit?: boolean }} [options]
 */
async function releaseActiveReservationForSession(req, options = {}) {
  const reason = options.reason || 'session_release';
  const skipAudit = Boolean(options.skipAudit);
  const reservation = await findActiveReservationBySession(req);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    return { cancelled: false, reservation: null };
  }

  const { reservation: updated } = await changeStatus({
    reservationId: reservation.id,
    newStatus: 'cancelled',
    reason,
    actor: { type: 'customer', req, userId: req?.session?.user?.id },
    patch: { holdExpiresAt: new Date() },
  });

  logEvent.info('reservation.cancelled', {
    reservationId: reservation.id?.toString?.(),
    reason,
  });

  // Guard: early-return or throw when required input is missing/invalid.
  if (!skipAudit) {
    const action =
      reason === 'checkout_cancel'
        ? 'customer.cancelled_checkout'
        : 'customer.released_hold';
    await logCustomerAction(req, {
      action,
      entityType: 'reservation',
      entityId: reservation.id,
      metadata: { reason },
    });
  }

  return { cancelled: true, reservation: updated };
}

/** Refresh hold TTL in memory (caller persists via changeStatus patch). */
function extendReservationHold(reservation) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    return reservation;
  }

  reservation.holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_MS);
  return reservation;
}

/**
 * Check holds, open physical rentals, and booked calendar overlaps for a range.
 * @returns {Promise<{ overlappingReservation: *, openPhysicalRental: *, bookedOverlap: * }>}
 */
async function checkCarAvailabilityForRange({
  carId,
  startDate,
  endDate,
  now = new Date(),
}) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId || !(startDate instanceof Date) || !(endDate instanceof Date)) {
    throw new Error('checkCarAvailabilityForRange: invalid arguments');
  }

  const overlappingReservation = await reservationRepository.findOverlappingHold({
    carId,
    startDate,
    endDate,
    now,
  });
  const openPhysicalRental = await reservationRepository.findOpenPhysicalRental(carId);
  const bookedOverlap = await reservationRepository.findBookedDateOverlap(
    carId,
    startDate,
    endDate
  );

  return {
    overlappingReservation,
    openPhysicalRental,
    bookedOverlap,
  };
}

/**
 * Create a pending_payment hold with availability check; records initial status history.
 * @param {object} payload
 * @param {import('express').Request|null} [req]
 */
async function createPendingReservation(payload, req = null) {
  const userId = req?.session?.user?.id ?? null;
  const result = await reservationRepository.createWithAvailabilityCheck({
    ...payload,
    userId,
  });
  const created = result?.existingActiveReservation ? null : result?.reservation || null;

  if (created) {
    await recordInitialStatus({
      reservationId: created.id,
      status: 'pending_payment',
      reason: 'created',
      actor: { type: 'customer', req, userId: req?.session?.user?.id },
      metadata: {
        carId: payload?.carId,
        sessionId: payload?.sessionId,
      },
    });

    logEvent.info('reservation.created', {
      reservationId: created.id?.toString?.(),
      carId: payload?.carId?.toString?.(),
      sessionId: payload?.sessionId,
    });

    if (req) {
      await logCustomerAction(req, {
        action: 'customer.created_hold',
        entityType: 'reservation',
        entityId: created.id,
        metadata: {
          carId: payload?.carId,
          sessionId: payload?.sessionId,
          from:
            payload?.startDate instanceof Date
              ? payload.startDate.toISOString()
              : payload?.startDate,
          to:
            payload?.endDate instanceof Date
              ? payload.endDate.toISOString()
              : payload?.endDate,
        },
      });
    }
  }

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
    return reservation;
  }

  const rawCarId =
    reservation.carId && typeof reservation.carId === 'object'
      ? reservation.carId.id
      : reservation.carId;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!rawCarId) {
    return reservation;
  }

  const car = await carRepository.findById(rawCarId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car) {
    return reservation;
  }

  return {
    ...reservation,
    carId: { id: car.id, name: car.name },
  };
}

/**
 * For processing holds past TTL: finalize if Stripe paid, expire if session expired,
 * keep if Checkout is still open.
 * @param {Date} [now]
 */
async function reconcileProcessingStripeReservations(now = new Date()) {
  const candidates = await reservationRepository.findProcessingWithExpiredHold(now);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!candidates.length) {
    return { checked: 0, expired: 0, finalized: 0, kept: 0 };
  }

  let expired = 0;
  let finalized = 0;
  let kept = 0;

  for (const reservation of candidates) {
    const stripeSessionId = reservation.stripeSessionId;
    // Stripe / payment-related branch.
    if (!stripeSessionId) {
      continue;
    }

    // Protected block: isolate failure modes.
    try {
      const session = await retrieveStripeCheckoutSession(stripeSessionId);

      if (session.payment_status === 'paid') {
        const result = await finalizeReservationByStripeSessionId(stripeSessionId, {
          reservationId: reservation.id,
          carId: reservation.carId?.id || reservation.carId,
          sessionId: reservation.sessionId,
          stripeSessionPaymentStatus: session.payment_status,
          stripeSessionAmountTotal: session.amount_total ?? null,
          stripeSessionCurrency: session.currency || null,
          logPrefix: '[CleanupStripeReconcile]',
        });

        if (result.finalized || result.reason === 'already_confirmed') {
          finalized += 1;
        }
        continue;
      }

      if (session.status === 'open') {
        kept += 1;
        continue;
      }

      if (session.status === 'expired' && session.payment_status !== 'paid') {
        try {
          await changeStatus({
            reservationId: reservation.id,
            newStatus: 'expired',
            reason: 'stripe_session_expired',
            actor: { type: 'system' },
            patch: { holdExpiresAt: now },
          });
          expired += 1;
        } catch (statusErr) {
          if (statusErr.code !== 'INVALID_STATUS_TRANSITION') {
            throw statusErr;
          }
        }
      }
    } catch (err) {
      logger.error(
        {
          err,
          reservationId: reservation.id,
          stripeSessionId,
          context: 'reconcileProcessingStripeReservations',
        },
        'Stripe checkout reconcile failed during cleanup'
      );
    }
  }

  return { checked: candidates.length, expired, finalized, kept };
}

/**
 * Job: expire holds whose browse sessions died, then reconcile Stripe processing holds.
 */
async function cleanUpAbandonedReservations() {
  // Protected block: isolate failure modes.
  try {
    const nowUTC = new Date();
    const activeSids = await sessionSql.listActiveSessionIds();
    const abandoned = await reservationRepository.markAbandoned(activeSids, nowUTC);
    const modifiedCount =
      typeof abandoned === 'number' ? abandoned : abandoned?.count || 0;
    const expiredIds =
      typeof abandoned === 'object' && Array.isArray(abandoned?.reservationIds)
        ? abandoned.reservationIds
        : [];

    if (modifiedCount) {
      logger.info({ modifiedCount }, 'Marked reservations as expired or abandoned');
      logEvent.info('checkout.abandoned', { count: modifiedCount });
      metrics.incrementCheckoutAbandoned(modifiedCount);
      await logSystemAction({
        action: 'system.abandoned_reservations',
        entityType: 'reservation',
        metadata: { count: modifiedCount },
      });

      // SQL expiry bypasses status listeners — publish payment_failed for ops.
      try {
        const { publishPaymentFailed } = require('../modules/realtime/realtime.publisher');
        for (const reservationId of expiredIds) {
          publishPaymentFailed({
            reservationId,
            status: 'expired',
            reason: 'abandoned_hold',
          });
        }
      } catch (liveErr) {
        logger.error(
          { err: liveErr, context: 'cleanUpAbandonedReservations' },
          'Abandoned hold live event hook error'
        );
      }
    }

    const stripeReconcile = await reconcileProcessingStripeReservations(nowUTC);
    // Stripe / payment-related branch.
    if (stripeReconcile.finalized || stripeReconcile.expired) {
      logger.info(stripeReconcile, 'Reconciled processing Stripe checkout reservations');
    }
  } catch (err) {
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
    return;
  }

  // Protected block: isolate failure modes.
  try {
    const {
      publishLiveEvent,
      publishCalendarUpdated,
    } = require('../modules/realtime/realtime.publisher');
    const carId =
      result.reservation.carId?.id || result.reservation.carId || result.historyMetadata?.toCarId;
    publishLiveEvent('reservation_updated', {
      reservationId: result.reservation.id,
      carId,
      status: result.reservation.status,
      oldStatus: 'pending_payment',
      meta: result.historyMetadata || {},
    });
    publishCalendarUpdated({
      action: 'customer_reheld',
      entityType: 'reservation',
      entityId: result.reservation.id,
      meta: result.historyMetadata || {},
    });
  } catch (err) {
    logger.error({ err, context: 'publishReholdSideEffects' }, 'Rehold live event hook error');
  }
}

/**
 * Atomically release the current session hold and create a new one (car/date change).
 */
async function releaseAndReholdForSession(req, {
  carId,
  startDate,
  endDate,
  pickupTime,
  returnTime,
  pickupLocation,
  returnLocation,
  pricing,
}) {
  const sessionId = getSessionId(req);

  const result = await reservationRepository.reholdWithAvailabilityCheck({
    sessionId,
    carId,
    startDate,
    endDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    pricing,
  });

  if (result.ok) {
    logEvent.info('reservation.reheld', {
      reservationId: result.reservation?.id?.toString?.(),
      fromCarId: result.fromCarId,
      toCarId: carId?.toString?.() || carId,
      sessionId,
    });
    publishReholdSideEffects(result);
  }

  return result;
}

module.exports = {
  findActiveReservationBySession,
  releaseActiveReservationForSession,
  releaseAndReholdForSession,
  extendReservationHold,
  attachCarNameToReservation,
  checkCarAvailabilityForRange,
  createPendingReservation,
  cleanUpAbandonedReservations,
  reconcileProcessingStripeReservations,
};
