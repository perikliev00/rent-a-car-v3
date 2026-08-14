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

async function finalizeReservationCore(stripeSessionId, options = {}, client = null) {
  const { logPrefix, requireActiveStatus = false, reservationId, carId, sessionId } = options;

  if (!stripeSessionId) {
    throw new NotFoundError('Stripe checkout session was not provided.');
  }

  const reservation = await resolveReservationForStripeSession(
    stripeSessionId,
    { reservationId, carId, sessionId },
    client
  );

  if (!reservation) {
    if (logPrefix) {
      logger.warn(
        { stripeSessionId, logPrefix },
        'No reservation for stripe session'
      );
    }

    return { found: false, finalized: false, reservation: null, reason: 'not_found' };
  }

  const existingOrderBySession = await orderSql.findOrderByStripeSessionId(
    stripeSessionId,
    client
  );
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

  if (!sessionValidation.ok) {
    return sessionValidation;
  }

  const paymentStatus = await resolveStripePaymentStatus(stripeSessionId, options);

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
      },
      client,
    });
  }

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

  try {
    const hasTxClient = Boolean(client && typeof client.query === 'function');

    if (hasTxClient) {
      await client.query('SAVEPOINT booking_finalize');
    }

    const finalized = await completeReservationFinalization({
      reservation,
      stripeSessionId,
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
      options,
      paymentStatus,
      logPrefix,
      client,
    });
  }
}

module.exports = {
  finalizeReservationCore,
};
