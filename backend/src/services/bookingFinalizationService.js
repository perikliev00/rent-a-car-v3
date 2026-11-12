/**
 * Public facade for booking finalization: transactional finalize by Stripe session,
 * re-export webhook processing, and post-commit confirmation emails.
 */
const { runWithTransaction } = require('../db/transaction');
const { finalizeReservationCore } = require('./bookingFinalization/finalizeReservationCore');
const {
  processStripeWebhookEvent,
} = require('./bookingFinalization/webhookEventProcessingService');
const { sendEmailsAfterCommit } = require('./bookingFinalization/sendEmailsAfterCommit');

/**
 * Finalize a reservation for a Stripe Checkout session in its own transaction,
 * then send confirmation emails after commit.
 *
 * @param {string} stripeSessionId
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function finalizeReservationByStripeSessionId(stripeSessionId, options = {}) {
  let result;

  // Open a DB transaction so writes commit atomically.
  await runWithTransaction(async (client) => {
    result = await finalizeReservationCore(stripeSessionId, options, client);
  });

  sendEmailsAfterCommit(result);
  return result;
}

module.exports = {
  finalizeReservationByStripeSessionId,
  processStripeWebhookEvent,
  sendEmailsAfterCommit,
};
