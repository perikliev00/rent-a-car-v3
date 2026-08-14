const reservationRepository = require('../../repositories/reservationRepository');
const orderSql = require('../sql/orderSqlService');
const { isOpsLifecycleStatus } = require('../../domain/reservationStatus');
const { ConflictError } = require('../../utils/appError');
const { isUniqueViolation } = require('../../db/transaction');
const logger = require('../../utils/logger');
const { markPaidReservationConflict } = require('./paidConflictManualReviewService');
const { completeReservationFinalization } = require('./paidReservationFinalizationService');
const {
  isStripeSessionPaid,
  resolveStripePaymentStatus,
} = require('./stripeSessionResolutionService');

async function resolveConcurrentFinalizationResult({
  reservation,
  stripeSessionId,
  client,
  logPrefix,
}) {
  const existingOrder =
    (await orderSql.findOrderByStripeSessionId(stripeSessionId, client)) ||
    (await orderSql.findOrderByReservationId(reservation.id, client));

  if (existingOrder) {
    if (logPrefix) {
      logger.info(
        {
          reservationId: reservation.id?.toString?.(),
          stripeSessionId,
          orderId: existingOrder.id,
          logPrefix,
        },
        'Concurrent finalization resolved to already_confirmed'
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

  const latest =
    (await reservationRepository.findByStripeSessionId(stripeSessionId, client)) ||
    (await reservationRepository.findById(reservation.id, client));

  if (latest?.status === 'confirmed' || isOpsLifecycleStatus(latest?.status)) {
    return {
      found: true,
      finalized: false,
      reservation: latest,
      order: null,
      reason: 'already_confirmed',
    };
  }

  return null;
}

async function handleFinalizationOverlap(
  err,
  { reservation, stripeSessionId, options, paymentStatus, logPrefix, client }
) {
  const concurrent = await resolveConcurrentFinalizationResult({
    reservation,
    stripeSessionId,
    client,
    logPrefix,
  });
  if (concurrent) {
    return concurrent;
  }

  if (isUniqueViolation(err)) {
    const afterUnique = await resolveConcurrentFinalizationResult({
      reservation,
      stripeSessionId,
      client,
      logPrefix,
    });
    if (afterUnique) {
      return afterUnique;
    }
    throw err;
  }

  if (!err || err.code !== 'OVERLAP') {
    throw err;
  }

  const isPaidContext =
    options.isPaidStripeWebhook === true ||
    isStripeSessionPaid(paymentStatus) ||
    isStripeSessionPaid(options.stripeSessionPaymentStatus);

  if (!isPaidContext) {
    throw new ConflictError(
      'The requested booking overlaps with an existing reservation.'
    );
  }

  return markPaidReservationConflict({
    reservation,
    stripeSessionId,
    conflictReason: 'overlap_after_payment',
    paidAmount: options.paidAmount ?? reservation.totalPrice ?? null,
    stripePaymentIntent:
      options.stripePaymentIntent ?? reservation.stripePaymentIntentId ?? null,
    logPrefix,
    client,
    resultReason: 'overlap_after_payment',
  });
}

async function finalizePaidExpiredHold({
  reservation,
  stripeSessionId,
  options,
  client,
}) {
  const { logPrefix, paidAmount } = options;
  const holdExpiresAt = reservation.holdExpiresAt ? new Date(reservation.holdExpiresAt) : null;

  try {
    const hasTxClient = Boolean(client && typeof client.query === 'function');

    if (hasTxClient) {
      await client.query('SAVEPOINT booking_finalize_expired');
    }

    const finalized = await completeReservationFinalization({
      reservation,
      stripeSessionId,
      logPrefix,
      client,
      recoveryContext: { holdExpiresAt },
    });

    if (hasTxClient) {
      await client.query('RELEASE SAVEPOINT booking_finalize_expired');
    }

    return finalized;
  } catch (err) {
    if (client && typeof client.query === 'function') {
      try {
        await client.query('ROLLBACK TO SAVEPOINT booking_finalize_expired');
      } catch {
        // Keep the original finalization error if savepoint rollback fails.
      }
    }

    const paymentStatus = await resolveStripePaymentStatus(stripeSessionId, options);
    return handleFinalizationOverlap(err, {
      reservation,
      stripeSessionId,
      options: { ...options, paidAmount },
      paymentStatus,
      logPrefix,
      client,
    });
  }
}

module.exports = {
  resolveConcurrentFinalizationResult,
  handleFinalizationOverlap,
  finalizePaidExpiredHold,
};
