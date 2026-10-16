/**
 * Process checkout.session.completed webhooks with at-most-once semantics via
 * processed_stripe_events insert. Records payment_events outcomes and sends
 * confirmation emails only after the transaction commits.
 */
const stripeEventSql = require('../sql/processedStripeEventSqlService');
const paymentEventSql = require('../sql/paymentEventSqlService');
const { ConflictError, NotFoundError } = require('../../utils/appError');
const { runWithTransaction } = require('../../db/transaction');
const { isStripeSessionPaid } = require('./stripeSessionResolutionService');
const { finalizeReservationCore } = require('./finalizeReservationCore');

/**
 * Idempotent webhook processing for a Stripe checkout.session.completed event.
 *
 * @param {object} params
 * @returns {Promise<object>} Finalization result
 */
async function processStripeWebhookEvent({
  eventId,
  stripeSessionId,
  reservationId,
  carId,
  sessionId,
  stripeSessionPaymentStatus,
  stripeSessionAmountTotal,
  stripeSessionCurrency,
  stripePaymentIntent,
  logPrefix,
}) {
  // Stripe / payment-related branch.
  if (!eventId || !stripeSessionId) {
    throw new NotFoundError('Stripe webhook event payload is incomplete.');
  }

  let result;

  // Open a DB transaction so writes commit atomically.
  await runWithTransaction(async (client) => {
    // Unique eventId insert is the idempotency gate for Stripe redeliveries.
    const inserted = await stripeEventSql.insertProcessedEvent(
      { eventId, stripeSessionId },
      client
    );

    // Guard: early-return or throw when required input is missing/invalid.
    if (!inserted) {
      result = {
        found: true,
        finalized: false,
        reservation: null,
        reason: 'duplicate_event',
      };
      return;
    }

    const isPaidStripeWebhook = isStripeSessionPaid(stripeSessionPaymentStatus);

    result = await finalizeReservationCore(
      stripeSessionId,
      {
        logPrefix,
        requireActiveStatus: true,
        reservationId,
        carId,
        sessionId,
        stripeSessionPaymentStatus,
        stripeSessionAmountTotal,
        stripeSessionCurrency,
        stripePaymentIntent,
        isPaidStripeWebhook,
      },
      client
    );

    if (result?.finalized) {
      await paymentEventSql.insertPaymentEvent(
        {
          eventId,
          eventType: 'checkout.session.completed',
          stripeSessionId,
          reservationId: result.reservation?.id,
          status: 'finalized',
          payload: { reason: result.reason },
        },
        client
      );
    } else if (result?.reason === 'already_confirmed') {
      await paymentEventSql.insertPaymentEvent(
        {
          eventId,
          eventType: 'checkout.session.completed',
          stripeSessionId,
          reservationId: result.reservation?.id,
          status: 'already_confirmed',
        },
        client
      );
    } else if (
      result?.reason === 'overlap_after_payment' ||
      result?.reason === 'paid_after_cancel' ||
      result?.reason === 'paid_conflict' ||
      result?.reason === 'stale_stripe_session' ||
      result?.reason === 'stripe_amount_mismatch' ||
      result?.reason === 'stripe_currency_mismatch'
    ) {
      await paymentEventSql.insertPaymentEvent(
        {
          eventId,
          eventType: 'checkout.session.completed',
          stripeSessionId,
          reservationId: result.reservation?.id,
          status: 'manual_review',
          payload: { reason: result.reason },
        },
        client
      );
    }
  });

  const { sendEmailsAfterCommit } = require('./sendEmailsAfterCommit');
  sendEmailsAfterCommit(result);

  if (result && result.reason === 'finalized') {
    return result;
  }

  // Known non-success reasons are returned to the webhook layer; unknown is a conflict.
  if (
    result &&
    result.reason !== 'duplicate_event' &&
    result.reason !== 'already_confirmed' &&
    result.reason !== 'status_not_active' &&
    result.reason !== 'hold_expired' &&
    result.reason !== 'overlap_after_payment' &&
    result.reason !== 'paid_after_cancel' &&
    result.reason !== 'paid_conflict' &&
    result.reason !== 'stale_stripe_session' &&
    result.reason !== 'stripe_amount_mismatch' &&
    result.reason !== 'stripe_currency_mismatch' &&
    result.reason !== 'payment_not_paid' &&
    result.reason !== 'not_found'
  ) {
    throw new ConflictError('Stripe webhook finalization completed with an unknown state.');
  }

  return result;
}

module.exports = {
  processStripeWebhookEvent,
};
