/**
 * Core paid-reservation finalization: locate reservation by Stripe session,
 * enforce session link/amount validation, then create order or recover conflicts.
 * Shared by webhooks, success page, and reconcile jobs.
 */
const orderSql = require('../sql/orderSqlService');
const { ACTIVE_RESERVATION_STATUSES } = require('../../utils/reservationHelpers');
const { isOpsLifecycleStatus } = require('../../domain/reservationStatus');
const { AppError, NotFoundError } = require('../../utils/appError');
const logger = require('../../utils/logger');
const {
  isStripeSessionPaid,
  resolveReservationForStripeSession,
  resolveStripePaymentStatus,
  validateStripeSessionForFinalization,
} = require('./stripeSessionResolutionService');
const {
  isHoldExpired,
  completeReservationFinalization,
} = require('./paidReservationFinalizationService');
const {
  finalizePaidExpiredHold,
  handleFinalizationOverlap,
} = require('./concurrentFinalizationRecoveryService');
const { markPaidReservationConflict } = require('./paidConflictManualReviewService');
const { paidSnapshotFromFinalizationContext } = require('../payment/stripeSessionValidation');

/**
 * Finalize a reservation for a paid Stripe Checkout session.
 *
 * @param {string} stripeSessionId
 * @param {object} [options]
 * @param {object|null} [client] - Optional DB client for transactional callers
 * @returns {Promise<object>} Result with found/finalized/reason fields
 */
async function finalizeReservationCore(stripeSessionId, options = {}, client = null) {
  const { logPrefix, requireActiveStatus = false, reservationId, carId, sessionId } = options;

  // Require a Checkout session id — without it there is nothing to finalize.
  if (!stripeSessionId) {
    throw new NotFoundError('Stripe checkout session was not provided.');
  }

  // Resolve reservation by session metadata / client_reference_id (and optional hints).
  const reservation = await resolveReservationForStripeSession(
    stripeSessionId,
    { reservationId, carId, sessionId },
    client
  );

  // No linked reservation: webhook/success may retry later or surface not_found.
  if (!reservation) {
    if (logPrefix) {
      logger.warn(
        { stripeSessionId, logPrefix },
        'No reservation for stripe session'
      );
    }

    return { found: false, finalized: false, reservation: null, reason: 'not_found' };
  }

  // Idempotent: order already exists for this Stripe session.
  const existingOrderBySession = await orderSql.findOrderByStripeSessionId(
    stripeSessionId,
    client
  );
  // Idempotent: order already tied to this Stripe session — do not create again.
  if (existingOrderBySession) {
    if (logPrefix) {
      logger.info(
        {
          reservationId: reservation.id.toString(),
          stripeSessionId,
          orderId: existingOrderBySession.id,
          logPrefix,
        },
        'Order already exists for Stripe session'
      );
    }

    return {
      found: true,
      finalized: false,
      reservation,
      order: existingOrderBySession,
      reason: 'already_confirmed',
    };
  }

  const existingOrder = await orderSql.findOrderByReservationId(reservation.id, client);

  // Idempotent: ops lifecycle + order already present means finalization is done.
  if (isOpsLifecycleStatus(reservation.status) && existingOrder) {
    if (logPrefix) {
      logger.info(
        { reservationId: reservation.id.toString(), logPrefix },
        'Reservation already confirmed'
      );
    }

    return {
      found: true,
      finalized: false,
      reservation,
      order: existingOrder,
      reason: 'already_confirmed',
    };
  }

  // Confirmed without order (or order without confirmed) is a hard data corruption.
  if (isOpsLifecycleStatus(reservation.status) && !existingOrder) {
    throw new AppError(
      'FINALIZATION_STATE_CORRUPTED',
      500,
      'Reservation is marked as confirmed but has no matching order.',
      {
        reservationId: reservation.id.toString(),
      },
      { isOperational: false }
    );
  }

  // Order exists but reservation is not in ops lifecycle — data corruption, fail hard.
  if (existingOrder && !isOpsLifecycleStatus(reservation.status)) {
    throw new AppError(
      'FINALIZATION_STATE_CORRUPTED',
      500,
      'Reservation finalization is in an inconsistent state.',
      {
        reservationId: reservation.id.toString(),
        status: reservation.status,
      },
      { isOperational: false }
    );
  }

  const sessionValidation = await validateStripeSessionForFinalization({
    reservation,
    stripeSessionId,
    options,
    logPrefix,
    client,
  });

  // Session link/amount validation failed — return structured reason to caller.
  if (!sessionValidation.ok) {
    return sessionValidation;
  }

  // Confirm Stripe payment_status and capture paid amount snapshot for order create.
  const paymentStatus = await resolveStripePaymentStatus(stripeSessionId, options);
  const paidSnapshot = paidSnapshotFromFinalizationContext(
    options,
    sessionValidation.stripeSession
  );

  // Expired hold: unpaid → stop; paid → recover via paid-expired path.
  if (isHoldExpired(reservation)) {
    if (!isStripeSessionPaid(paymentStatus)) {
      if (logPrefix) {
        logger.warn(
          {
            reservationId: reservation.id.toString(),
            holdExpiresAt: reservation.holdExpiresAt,
            paymentStatus,
            logPrefix,
          },
          'Reservation hold has expired'
        );
      }

      return {
        found: true,
        finalized: false,
        reservation,
        order: existingOrder || null,
        reason: 'hold_expired',
      };
    }

    return finalizePaidExpiredHold({
      reservation,
      stripeSessionId,
      options: {
        ...options,
        paidAmount: options.paidAmount ?? reservation.totalPrice ?? null,
        paidAmountCents: paidSnapshot.paidAmountCents,
        paidCurrency: paidSnapshot.paidCurrency,
      },
      client,
    });
  }

  if (
    requireActiveStatus &&
    !ACTIVE_RESERVATION_STATUSES.includes(reservation.status) &&
    isStripeSessionPaid(paymentStatus)
  ) {
    // Cancelled holds cannot become paid; route paid money to manual review.
    if (reservation.status === 'cancelled') {
      return markPaidReservationConflict({
        reservation,
        stripeSessionId,
        conflictReason: 'paid_after_cancel',
        paidAmount: options.paidAmount ?? reservation.totalPrice ?? null,
        paidAmountCents: paidSnapshot.paidAmountCents,
        paidCurrency: paidSnapshot.paidCurrency,
        stripePaymentIntent:
          options.stripePaymentIntent ?? reservation.stripePaymentIntentId ?? null,
        logPrefix,
        client,
        resultReason: 'paid_after_cancel',
      });
    }

    return finalizePaidExpiredHold({
      reservation,
      stripeSessionId,
      options: {
        ...options,
        paidAmount: options.paidAmount ?? reservation.totalPrice ?? null,
        paidAmountCents: paidSnapshot.paidAmountCents,
        paidCurrency: paidSnapshot.paidCurrency,
      },
      client,
    });
  }

  // Caller required an active hold status and this reservation is not active.
  if (requireActiveStatus && !ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) {
    if (logPrefix) {
      logger.warn(
        {
          reservationId: reservation.id.toString(),
          status: reservation.status,
          logPrefix,
        },
        'Reservation status is not active'
      );
    }

    return {
      found: true,
      finalized: false,
      reservation,
      order: existingOrder || null,
      reason: 'status_not_active',
    };
  }

  // Never create an order for unpaid Checkout sessions.
  if (!isStripeSessionPaid(paymentStatus)) {
    if (logPrefix) {
      logger.warn(
        {
          reservationId: reservation.id.toString(),
          paymentStatus,
          stripeSessionId,
          logPrefix,
        },
        'Ignoring unpaid Stripe checkout session for finalization'
      );
    }

    return {
      found: true,
      finalized: false,
      reservation,
      order: existingOrder || null,
      reason: 'payment_not_paid',
    };
  }

  // Create order + confirm reservation; savepoint lets outer webhook tx recover on overlap.
  try {
    const hasTxClient = Boolean(client && typeof client.query === 'function');

    if (hasTxClient) {
      await client.query('SAVEPOINT booking_finalize');
    }

    const finalized = await completeReservationFinalization({
      reservation,
      stripeSessionId,
      stripePaymentIntent:
        options.stripePaymentIntent ?? reservation.stripePaymentIntentId ?? null,
      paidAmountCents: paidSnapshot.paidAmountCents,
      paidCurrency: paidSnapshot.paidCurrency,
      logPrefix,
      client,
    });

    if (hasTxClient) {
      await client.query('RELEASE SAVEPOINT booking_finalize');
    }

    return finalized;
  } catch (err) {
    if (client && typeof client.query === 'function') {
      try {
        await client.query('ROLLBACK TO SAVEPOINT booking_finalize');
      } catch {
        // Keep the original finalization error if savepoint rollback fails.
      }
    }

    return handleFinalizationOverlap(err, {
      reservation,
      stripeSessionId,
      options: {
        ...options,
        paidAmountCents: paidSnapshot.paidAmountCents,
        paidCurrency: paidSnapshot.paidCurrency,
      },
      paymentStatus,
      logPrefix,
      client,
    });
  }
}

module.exports = {
  finalizeReservationCore,
};
