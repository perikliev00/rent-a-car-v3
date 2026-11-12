/**
 * Process checkout.session.completed webhooks with at-most-once semantics via
 * processed_stripe_events insert. Records payment_events outcomes and sends
 * confirmation emails only after the transaction commits.
 */
const stripeEventSql = require('../sql/processedStripeEventSqlService');
// Require the '../sql/paymentEventSqlService' module as paymentEventSql.
const paymentEventSql = require('../sql/paymentEventSqlService');
// Destructure object properties into local variables.
const { ConflictError, NotFoundError } = require('../../utils/appError');
// Destructure object properties into local variables.
const { runWithTransaction } = require('../../db/transaction');
// Destructure object properties into local variables.
const { isStripeSessionPaid } = require('./stripeSessionResolutionService');
// Destructure object properties into local variables.
const { finalizeReservationCore } = require('./finalizeReservationCore');

/**
 * Idempotent webhook processing for a Stripe checkout.session.completed event.
 *
 * @param {object} params
 * @returns {Promise<object>} Finalization result
 */
async function processStripeWebhookEvent({
  // Contribute this line to the enclosing declaration or statement.
  eventId,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  sessionId,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionPaymentStatus,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionAmountTotal,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionCurrency,
  // Contribute this line to the enclosing declaration or statement.
  stripePaymentIntent,
  // Contribute this line to the enclosing declaration or statement.
  logPrefix,
// Continue the surrounding logic with this statement.
}) {
  // Stripe / payment-related branch.
  if (!eventId || !stripeSessionId) {
    // Throw an error to stop the current control flow.
    throw new NotFoundError('Stripe webhook event payload is incomplete.');
  }

  // Reserve the result variable for later assignment.
  let result;

  // Open a DB transaction so writes commit atomically.
  await runWithTransaction(async (client) => {
    // Unique eventId insert is the idempotency gate for Stripe redeliveries.
    const inserted = await stripeEventSql.insertProcessedEvent(
      // Contribute this line to the enclosing declaration or statement.
      { eventId, stripeSessionId },
      // Reference the identifier used by the enclosing expression.
      client
    );

    // Guard: early-return or throw when required input is missing/invalid.
    if (!inserted) {
      // Update result with the right-hand side value.
      result = {
        // Provide the found field value.
        found: true,
        // Provide the finalized field value.
        finalized: false,
        // Provide the reservation field value.
        reservation: null,
        // Provide the reason field value.
        reason: 'duplicate_event',
      };
      // Return control to the caller with the following value.
      return;
    }

    // Create the is paid stripe webhook constant.
    const isPaidStripeWebhook = isStripeSessionPaid(stripeSessionPaymentStatus);

    // Store the awaited result in result.
    result = await finalizeReservationCore(
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      {
        // Contribute this line to the enclosing declaration or statement.
        logPrefix,
        // Provide the require active status field value.
        requireActiveStatus: true,
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        sessionId,
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionPaymentStatus,
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionAmountTotal,
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionCurrency,
        // Contribute this line to the enclosing declaration or statement.
        stripePaymentIntent,
        // Contribute this line to the enclosing declaration or statement.
        isPaidStripeWebhook,
      },
      // Reference the identifier used by the enclosing expression.
      client
    );

    // Evaluate the condition and enter the branch when it is true.
    if (result?.finalized) {
      // Wait until the asynchronous operation resolves.
      await paymentEventSql.insertPaymentEvent(
        {
          // Contribute this line to the enclosing declaration or statement.
          eventId,
          // Provide the event type field value.
          eventType: 'checkout.session.completed',
          // Contribute this line to the enclosing declaration or statement.
          stripeSessionId,
          // Provide the reservation id field value.
          reservationId: result.reservation?.id,
          // Provide the status field value.
          status: 'finalized',
          // Provide the payload field value.
          payload: { reason: result.reason },
        },
        // Reference the identifier used by the enclosing expression.
        client
      );
    // Continue the surrounding logic with this statement.
    } else if (result?.reason === 'already_confirmed') {
      // Wait until the asynchronous operation resolves.
      await paymentEventSql.insertPaymentEvent(
        {
          // Contribute this line to the enclosing declaration or statement.
          eventId,
          // Provide the event type field value.
          eventType: 'checkout.session.completed',
          // Contribute this line to the enclosing declaration or statement.
          stripeSessionId,
          // Provide the reservation id field value.
          reservationId: result.reservation?.id,
          // Provide the status field value.
          status: 'already_confirmed',
        },
        // Reference the identifier used by the enclosing expression.
        client
      );
    // Continue the surrounding logic with this statement.
    } else if (
      // Continue the surrounding logic with this statement.
      result?.reason === 'overlap_after_payment' ||
      // Continue the surrounding logic with this statement.
      result?.reason === 'paid_after_cancel' ||
      // Continue the surrounding logic with this statement.
      result?.reason === 'paid_conflict' ||
      // Continue the surrounding logic with this statement.
      result?.reason === 'stale_stripe_session' ||
      // Continue the surrounding logic with this statement.
      result?.reason === 'stripe_amount_mismatch' ||
      // Continue the surrounding logic with this statement.
      result?.reason === 'stripe_currency_mismatch'
    // Continue the surrounding logic with this statement.
    ) {
      // Wait until the asynchronous operation resolves.
      await paymentEventSql.insertPaymentEvent(
        {
          // Contribute this line to the enclosing declaration or statement.
          eventId,
          // Provide the event type field value.
          eventType: 'checkout.session.completed',
          // Contribute this line to the enclosing declaration or statement.
          stripeSessionId,
          // Provide the reservation id field value.
          reservationId: result.reservation?.id,
          // Provide the status field value.
          status: 'manual_review',
          // Provide the payload field value.
          payload: { reason: result.reason },
        },
        // Reference the identifier used by the enclosing expression.
        client
      );
    }
  });

  // Destructure object properties into local variables.
  const { sendEmailsAfterCommit } = require('./sendEmailsAfterCommit');
  // Call sendEmailsAfterCommit to perform this step.
  sendEmailsAfterCommit(result);

  // Evaluate the condition and enter the branch when it is true.
  if (result && result.reason === 'finalized') {
    // Return the resulting value to the caller.
    return result;
  }

  // Known non-success reasons are returned to the webhook layer; unknown is a conflict.
  if (
    // Contribute this line to the enclosing declaration or statement.
    result &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'duplicate_event' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'already_confirmed' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'status_not_active' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'hold_expired' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'overlap_after_payment' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'paid_after_cancel' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'paid_conflict' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'stale_stripe_session' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'stripe_amount_mismatch' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'stripe_currency_mismatch' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'payment_not_paid' &&
    // Continue the surrounding logic with this statement.
    result.reason !== 'not_found'
  // Continue the surrounding logic with this statement.
  ) {
    // Throw an error to stop the current control flow.
    throw new ConflictError('Stripe webhook finalization completed with an unknown state.');
  }

  // Return the resulting value to the caller.
  return result;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  processStripeWebhookEvent,
};
