/**
 * Recovery paths when paid finalization races another writer or hits an overlap.
 * Resolves concurrent "already confirmed" outcomes, and routes paid+overlap
 * conflicts to manual review instead of rejecting money that Stripe already took.
 */
const reservationRepository = require('../../repositories/reservationRepository');
// Require the '../sql/orderSqlService' module as orderSql.
const orderSql = require('../sql/orderSqlService');
// Destructure object properties into local variables.
const { isOpsLifecycleStatus } = require('../../domain/reservationStatus');
// Destructure object properties into local variables.
const { ConflictError } = require('../../utils/appError');
// Destructure object properties into local variables.
const { isUniqueViolation } = require('../../db/transaction');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Destructure object properties into local variables.
const { markPaidReservationConflict } = require('./paidConflictManualReviewService');
// Destructure object properties into local variables.
const { completeReservationFinalization } = require('./paidReservationFinalizationService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  isStripeSessionPaid,
  // Contribute this line to the enclosing declaration or statement.
  resolveStripePaymentStatus,
// Continue the surrounding logic with this statement.
} = require('./stripeSessionResolutionService');

/**
 * After a race, check whether another worker already created the order / confirmed.
 * @returns {Promise<object|null>} already_confirmed result or null if still unresolved
 */
async function resolveConcurrentFinalizationResult({
  // Contribute this line to the enclosing declaration or statement.
  reservation,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  client,
  // Contribute this line to the enclosing declaration or statement.
  logPrefix,
// Continue the surrounding logic with this statement.
}) {
  // Create the existing order constant.
  const existingOrder =
    // Continue the surrounding logic with this statement.
    (await orderSql.findOrderByStripeSessionId(stripeSessionId, client)) ||
    // Continue the surrounding logic with this statement.
    (await orderSql.findOrderByReservationId(reservation.id, client));

  // Idempotency guard: return early when work was already applied.
  if (existingOrder) {
    // Evaluate the condition and enter the branch when it is true.
    if (logPrefix) {
      // Call logger.info to perform this step.
      logger.info(
        {
          // Provide the reservation id field value.
          reservationId: reservation.id?.toString?.(),
          // Contribute this line to the enclosing declaration or statement.
          stripeSessionId,
          // Provide the order id field value.
          orderId: existingOrder.id,
          // Contribute this line to the enclosing declaration or statement.
          logPrefix,
        },
        // Supply the literal value used by the enclosing expression.
        'Concurrent finalization resolved to already_confirmed'
      );
    }

    // Return the resulting value to the caller.
    return {
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: false,
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Provide the order field value.
      order: existingOrder,
      // Provide the reason field value.
      reason: 'already_confirmed',
    };
  }

  // Create the latest constant.
  const latest =
    // Continue the surrounding logic with this statement.
    (await reservationRepository.findByStripeSessionId(stripeSessionId, client)) ||
    // Continue the surrounding logic with this statement.
    (await reservationRepository.findById(reservation.id, client));

  // Status / lifecycle guard before mutating domain state.
  if (latest?.status === 'confirmed' || isOpsLifecycleStatus(latest?.status)) {
    // Return the resulting value to the caller.
    return {
      // Provide the found field value.
      found: true,
      // Provide the finalized field value.
      finalized: false,
      // Provide the reservation field value.
      reservation: latest,
      // Provide the order field value.
      order: null,
      // Provide the reason field value.
      reason: 'already_confirmed',
    };
  }

  // Return the resulting value to the caller.
  return null;
}

/**
 * Handle unique/overlap errors from finalization: prefer concurrent success,
 * else escalate paid overlaps to manual review (do not drop paid bookings).
 */
async function handleFinalizationOverlap(
  // Contribute this line to the enclosing declaration or statement.
  err,
  // Contribute this line to the enclosing declaration or statement.
  { reservation, stripeSessionId, options, paymentStatus, logPrefix, client }
// Continue the surrounding logic with this statement.
) {
  // Create the concurrent constant.
  const concurrent = await resolveConcurrentFinalizationResult({
    // Contribute this line to the enclosing declaration or statement.
    reservation,
    // Contribute this line to the enclosing declaration or statement.
    stripeSessionId,
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Contribute this line to the enclosing declaration or statement.
    logPrefix,
  });
  // Evaluate the condition and enter the branch when it is true.
  if (concurrent) {
    // Return the resulting value to the caller.
    return concurrent;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (isUniqueViolation(err)) {
    // Create the after unique constant.
    const afterUnique = await resolveConcurrentFinalizationResult({
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Contribute this line to the enclosing declaration or statement.
      logPrefix,
    });
    // Evaluate the condition and enter the branch when it is true.
    if (afterUnique) {
      // Return the resulting value to the caller.
      return afterUnique;
    }
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (!err || err.code !== 'OVERLAP') {
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the is paid context constant.
  const isPaidContext =
    // Update options.isPaidStripeWebhook with the right-hand side value.
    options.isPaidStripeWebhook === true ||
    // Call isStripeSessionPaid to perform this step.
    isStripeSessionPaid(paymentStatus) ||
    // Call isStripeSessionPaid to perform this step.
    isStripeSessionPaid(options.stripeSessionPaymentStatus);

  // Unpaid overlap is a normal conflict; paid overlap needs ops intervention.
  if (!isPaidContext) {
    // Throw an error to stop the current control flow.
    throw new ConflictError(
      // Supply the literal value used by the enclosing expression.
      'The requested booking overlaps with an existing reservation.'
    );
  }

  // Return the resulting value to the caller.
  return markPaidReservationConflict({
    // Contribute this line to the enclosing declaration or statement.
    reservation,
    // Contribute this line to the enclosing declaration or statement.
    stripeSessionId,
    // Provide the conflict reason field value.
    conflictReason: 'overlap_after_payment',
    // Provide the paid amount field value.
    paidAmount: options.paidAmount ?? reservation.totalPrice ?? null,
    // Provide the paid amount cents field value.
    paidAmountCents: options.paidAmountCents ?? null,
    // Provide the paid currency field value.
    paidCurrency: options.paidCurrency ?? null,
    // Provide the stripe payment intent field value.
    stripePaymentIntent:
      // Contribute this line to the enclosing declaration or statement.
      options.stripePaymentIntent ?? reservation.stripePaymentIntentId ?? null,
    // Contribute this line to the enclosing declaration or statement.
    logPrefix,
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Provide the result reason field value.
    resultReason: 'overlap_after_payment',
  });
}

/**
 * Finalize even when the hold TTL expired, because Stripe reports paid.
 * Uses a savepoint so overlap recovery can roll back only the finalize attempt.
 */
async function finalizePaidExpiredHold({
  // Contribute this line to the enclosing declaration or statement.
  reservation,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  options,
  // Contribute this line to the enclosing declaration or statement.
  client,
// Continue the surrounding logic with this statement.
}) {
  // Destructure object properties into local variables.
  const { logPrefix, paidAmount } = options;
  // Create the hold expires at constant.
  const holdExpiresAt = reservation.holdExpiresAt ? new Date(reservation.holdExpiresAt) : null;

  // Protected block: isolate failure modes.
  try {
    // Create the has tx client constant.
    const hasTxClient = Boolean(client && typeof client.query === 'function');

    // Evaluate the condition and enter the branch when it is true.
    if (hasTxClient) {
      // Wait until the asynchronous operation resolves.
      await client.query('SAVEPOINT booking_finalize_expired');
    }

    // Create the finalized constant.
    const finalized = await completeReservationFinalization({
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Provide the stripe payment intent field value.
      stripePaymentIntent:
        // Contribute this line to the enclosing declaration or statement.
        options.stripePaymentIntent ?? reservation.stripePaymentIntentId ?? null,
      // Provide the paid amount cents field value.
      paidAmountCents: options.paidAmountCents ?? null,
      // Provide the paid currency field value.
      paidCurrency: options.paidCurrency ?? null,
      // Contribute this line to the enclosing declaration or statement.
      logPrefix,
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Provide the recovery context field value.
      recoveryContext: { holdExpiresAt },
    });

    // Evaluate the condition and enter the branch when it is true.
    if (hasTxClient) {
      // Wait until the asynchronous operation resolves.
      await client.query('RELEASE SAVEPOINT booking_finalize_expired');
    }

    // Return the resulting value to the caller.
    return finalized;
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (client && typeof client.query === 'function') {
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await client.query('ROLLBACK TO SAVEPOINT booking_finalize_expired');
      // Contribute this line to the enclosing declaration or statement.
      } catch {
        // Keep the original finalization error if savepoint rollback fails.
      }
    }

    // Create the payment status constant.
    const paymentStatus = await resolveStripePaymentStatus(stripeSessionId, options);
    // Return the resulting value to the caller.
    return handleFinalizationOverlap(err, {
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Provide the options field value.
      options: { ...options, paidAmount },
      // Contribute this line to the enclosing declaration or statement.
      paymentStatus,
      // Contribute this line to the enclosing declaration or statement.
      logPrefix,
      // Contribute this line to the enclosing declaration or statement.
      client,
    });
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  resolveConcurrentFinalizationResult,
  // Contribute this line to the enclosing declaration or statement.
  handleFinalizationOverlap,
  // Contribute this line to the enclosing declaration or statement.
  finalizePaidExpiredHold,
};
