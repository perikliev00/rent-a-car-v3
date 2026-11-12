/**
 * Core paid-reservation finalization: locate reservation by Stripe session,
 * enforce session link/amount validation, then create order or recover conflicts.
 * Shared by webhooks, success page, and reconcile jobs.
 */
const orderSql = require('../sql/orderSqlService');
// Destructure object properties into local variables.
const { ACTIVE_RESERVATION_STATUSES } = require('../../utils/reservationHelpers');
// Destructure object properties into local variables.
const { isOpsLifecycleStatus } = require('../../domain/reservationStatus');
// Destructure object properties into local variables.
const { AppError, NotFoundError } = require('../../utils/appError');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  isStripeSessionPaid,
  // Contribute this line to the enclosing declaration or statement.
  resolveReservationForStripeSession,
  // Contribute this line to the enclosing declaration or statement.
  resolveStripePaymentStatus,
  // Contribute this line to the enclosing declaration or statement.
  validateStripeSessionForFinalization,
// Continue the surrounding logic with this statement.
} = require('./stripeSessionResolutionService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  isHoldExpired,
  // Contribute this line to the enclosing declaration or statement.
  completeReservationFinalization,
// Continue the surrounding logic with this statement.
} = require('./paidReservationFinalizationService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  finalizePaidExpiredHold,
  // Contribute this line to the enclosing declaration or statement.
  handleFinalizationOverlap,
// Continue the surrounding logic with this statement.
} = require('./concurrentFinalizationRecoveryService');
// Destructure object properties into local variables.
const { markPaidReservationConflict } = require('./paidConflictManualReviewService');
// Destructure object properties into local variables.
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
  // Destructure object properties into local variables.
  const { logPrefix, requireActiveStatus = false, reservationId, carId, sessionId } = options;

  // Require a Checkout session id — without it there is nothing to finalize.
  if (!stripeSessionId) {
    // Throw an error to stop the current control flow.
    throw new NotFoundError('Stripe checkout session was not provided.');
  }

  // Resolve reservation by session metadata / client_reference_id (and optional hints).
  const reservation = await resolveReservationForStripeSession(
    // Contribute this line to the enclosing declaration or statement.
    stripeSessionId,
    // Contribute this line to the enclosing declaration or statement.
    { reservationId, carId, sessionId },
    // Reference the identifier used by the enclosing expression.
    client
  );

  // No linked reservation: webhook/success may retry later or surface not_found.
  if (!reservation) {
    // Evaluate the condition and enter the branch when it is true.
    if (logPrefix) {
      // Call logger.warn to perform this step.
      logger.warn(
        // Contribute this line to the enclosing declaration or statement.
        { stripeSessionId, logPrefix },
        // Supply the literal value used by the enclosing expression.
        'No reservation for stripe session'
      );
    }

    // Return the resulting value to the caller.
    return { found: false, finalized: false, reservation: null, reason: 'not_found' };
  }

  // Idempotent: order already exists for this Stripe session.
  const existingOrderBySession = await orderSql.findOrderByStripeSessionId(
    // Contribute this line to the enclosing declaration or statement.
    stripeSessionId,
    // Reference the identifier used by the enclosing expression.
    client
  );
  // Idempotent: order already tied to this Stripe session — do not create again.
  if (existingOrderBySession) {
    // Evaluate the condition and enter the branch when it is true.
    if (logPrefix) {
      // Call logger.info to perform this step.
      logger.info(
        {
          // Provide the reservation id field value.
          reservationId: reservation.id.toString(),
          // Contribute this line to the enclosing declaration or statement.
          stripeSessionId,
          // Provide the order id field value.
          orderId: existingOrderBySession.id,
          // Contribute this line to the enclosing declaration or statement.
          logPrefix,
        },
        // Supply the literal value used by the enclosing expression.
        'Order already exists for Stripe session'
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
      order: existingOrderBySession,
      // Provide the reason field value.
      reason: 'already_confirmed',
    };
  }

  // Create the existing order constant.
  const existingOrder = await orderSql.findOrderByReservationId(reservation.id, client);

  // Idempotent: ops lifecycle + order already present means finalization is done.
  if (isOpsLifecycleStatus(reservation.status) && existingOrder) {
    // Evaluate the condition and enter the branch when it is true.
    if (logPrefix) {
      // Call logger.info to perform this step.
      logger.info(
        // Continue the surrounding logic with this statement.
        { reservationId: reservation.id.toString(), logPrefix },
        // Supply the literal value used by the enclosing expression.
        'Reservation already confirmed'
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

  // Confirmed without order (or order without confirmed) is a hard data corruption.
  if (isOpsLifecycleStatus(reservation.status) && !existingOrder) {
    // Throw an error to stop the current control flow.
    throw new AppError(
      // Supply the literal value used by the enclosing expression.
      'FINALIZATION_STATE_CORRUPTED',
      // Supply the literal value used by the enclosing expression.
      500,
      // Apply the TypeScript type assertion for this value.
      'Reservation is marked as confirmed but has no matching order.',
      {
        // Provide the reservation id field value.
        reservationId: reservation.id.toString(),
      },
      // Contribute this line to the enclosing declaration or statement.
      { isOperational: false }
    );
  }

  // Order exists but reservation is not in ops lifecycle — data corruption, fail hard.
  if (existingOrder && !isOpsLifecycleStatus(reservation.status)) {
    // Throw an error to stop the current control flow.
    throw new AppError(
      // Supply the literal value used by the enclosing expression.
      'FINALIZATION_STATE_CORRUPTED',
      // Supply the literal value used by the enclosing expression.
      500,
      // Supply the literal value used by the enclosing expression.
      'Reservation finalization is in an inconsistent state.',
      {
        // Provide the reservation id field value.
        reservationId: reservation.id.toString(),
        // Provide the status field value.
        status: reservation.status,
      },
      // Contribute this line to the enclosing declaration or statement.
      { isOperational: false }
    );
  }

  // Create the session validation constant.
  const sessionValidation = await validateStripeSessionForFinalization({
    // Contribute this line to the enclosing declaration or statement.
    reservation,
    // Contribute this line to the enclosing declaration or statement.
    stripeSessionId,
    // Contribute this line to the enclosing declaration or statement.
    options,
    // Contribute this line to the enclosing declaration or statement.
    logPrefix,
    // Contribute this line to the enclosing declaration or statement.
    client,
  });

  // Session link/amount validation failed — return structured reason to caller.
  if (!sessionValidation.ok) {
    // Return the resulting value to the caller.
    return sessionValidation;
  }

  // Confirm Stripe payment_status and capture paid amount snapshot for order create.
  const paymentStatus = await resolveStripePaymentStatus(stripeSessionId, options);
  // Create the paid snapshot constant.
  const paidSnapshot = paidSnapshotFromFinalizationContext(
    // Contribute this line to the enclosing declaration or statement.
    options,
    // Contribute this line to the enclosing declaration or statement.
    sessionValidation.stripeSession
  );

  // Expired hold: unpaid → stop; paid → recover via paid-expired path.
  if (isHoldExpired(reservation)) {
    // Evaluate the condition and enter the branch when it is true.
    if (!isStripeSessionPaid(paymentStatus)) {
      // Evaluate the condition and enter the branch when it is true.
      if (logPrefix) {
        // Call logger.warn to perform this step.
        logger.warn(
          {
            // Provide the reservation id field value.
            reservationId: reservation.id.toString(),
            // Provide the hold expires at field value.
            holdExpiresAt: reservation.holdExpiresAt,
            // Contribute this line to the enclosing declaration or statement.
            paymentStatus,
            // Contribute this line to the enclosing declaration or statement.
            logPrefix,
          },
          // Supply the literal value used by the enclosing expression.
          'Reservation hold has expired'
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
        order: existingOrder || null,
        // Provide the reason field value.
        reason: 'hold_expired',
      };
    }

    // Return the resulting value to the caller.
    return finalizePaidExpiredHold({
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Provide the options field value.
      options: {
        // Spread options into the surrounding structure.
        ...options,
        // Provide the paid amount field value.
        paidAmount: options.paidAmount ?? reservation.totalPrice ?? null,
        // Provide the paid amount cents field value.
        paidAmountCents: paidSnapshot.paidAmountCents,
        // Provide the paid currency field value.
        paidCurrency: paidSnapshot.paidCurrency,
      },
      // Contribute this line to the enclosing declaration or statement.
      client,
    });
  }

  // Evaluate the condition and enter the branch when it is true.
  if (
    // Contribute this line to the enclosing declaration or statement.
    requireActiveStatus &&
    // Continue the surrounding logic with this statement.
    !ACTIVE_RESERVATION_STATUSES.includes(reservation.status) &&
    // Call isStripeSessionPaid to perform this step.
    isStripeSessionPaid(paymentStatus)
  // Continue the surrounding logic with this statement.
  ) {
    // Cancelled holds cannot become paid; route paid money to manual review.
    if (reservation.status === 'cancelled') {
      // Return the resulting value to the caller.
      return markPaidReservationConflict({
        // Contribute this line to the enclosing declaration or statement.
        reservation,
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionId,
        // Provide the conflict reason field value.
        conflictReason: 'paid_after_cancel',
        // Provide the paid amount field value.
        paidAmount: options.paidAmount ?? reservation.totalPrice ?? null,
        // Provide the paid amount cents field value.
        paidAmountCents: paidSnapshot.paidAmountCents,
        // Provide the paid currency field value.
        paidCurrency: paidSnapshot.paidCurrency,
        // Provide the stripe payment intent field value.
        stripePaymentIntent:
          // Contribute this line to the enclosing declaration or statement.
          options.stripePaymentIntent ?? reservation.stripePaymentIntentId ?? null,
        // Contribute this line to the enclosing declaration or statement.
        logPrefix,
        // Contribute this line to the enclosing declaration or statement.
        client,
        // Provide the result reason field value.
        resultReason: 'paid_after_cancel',
      });
    }

    // Return the resulting value to the caller.
    return finalizePaidExpiredHold({
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Provide the options field value.
      options: {
        // Spread options into the surrounding structure.
        ...options,
        // Provide the paid amount field value.
        paidAmount: options.paidAmount ?? reservation.totalPrice ?? null,
        // Provide the paid amount cents field value.
        paidAmountCents: paidSnapshot.paidAmountCents,
        // Provide the paid currency field value.
        paidCurrency: paidSnapshot.paidCurrency,
      },
      // Contribute this line to the enclosing declaration or statement.
      client,
    });
  }

  // Caller required an active hold status and this reservation is not active.
  if (requireActiveStatus && !ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) {
    // Evaluate the condition and enter the branch when it is true.
    if (logPrefix) {
      // Call logger.warn to perform this step.
      logger.warn(
        {
          // Provide the reservation id field value.
          reservationId: reservation.id.toString(),
          // Provide the status field value.
          status: reservation.status,
          // Contribute this line to the enclosing declaration or statement.
          logPrefix,
        },
        // Supply the literal value used by the enclosing expression.
        'Reservation status is not active'
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
      order: existingOrder || null,
      // Provide the reason field value.
      reason: 'status_not_active',
    };
  }

  // Never create an order for unpaid Checkout sessions.
  if (!isStripeSessionPaid(paymentStatus)) {
    // Evaluate the condition and enter the branch when it is true.
    if (logPrefix) {
      // Call logger.warn to perform this step.
      logger.warn(
        {
          // Provide the reservation id field value.
          reservationId: reservation.id.toString(),
          // Contribute this line to the enclosing declaration or statement.
          paymentStatus,
          // Contribute this line to the enclosing declaration or statement.
          stripeSessionId,
          // Contribute this line to the enclosing declaration or statement.
          logPrefix,
        },
        // Supply the literal value used by the enclosing expression.
        'Ignoring unpaid Stripe checkout session for finalization'
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
      order: existingOrder || null,
      // Provide the reason field value.
      reason: 'payment_not_paid',
    };
  }

  // Create order + confirm reservation; savepoint lets outer webhook tx recover on overlap.
  try {
    // Create the has tx client constant.
    const hasTxClient = Boolean(client && typeof client.query === 'function');

    // Evaluate the condition and enter the branch when it is true.
    if (hasTxClient) {
      // Wait until the asynchronous operation resolves.
      await client.query('SAVEPOINT booking_finalize');
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
      paidAmountCents: paidSnapshot.paidAmountCents,
      // Provide the paid currency field value.
      paidCurrency: paidSnapshot.paidCurrency,
      // Contribute this line to the enclosing declaration or statement.
      logPrefix,
      // Contribute this line to the enclosing declaration or statement.
      client,
    });

    // Evaluate the condition and enter the branch when it is true.
    if (hasTxClient) {
      // Wait until the asynchronous operation resolves.
      await client.query('RELEASE SAVEPOINT booking_finalize');
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
        await client.query('ROLLBACK TO SAVEPOINT booking_finalize');
      // Contribute this line to the enclosing declaration or statement.
      } catch {
        // Keep the original finalization error if savepoint rollback fails.
      }
    }

    // Return the resulting value to the caller.
    return handleFinalizationOverlap(err, {
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Provide the options field value.
      options: {
        // Spread options into the surrounding structure.
        ...options,
        // Provide the paid amount cents field value.
        paidAmountCents: paidSnapshot.paidAmountCents,
        // Provide the paid currency field value.
        paidCurrency: paidSnapshot.paidCurrency,
      },
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
  finalizeReservationCore,
};
