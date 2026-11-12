/**
 * Public facade for booking finalization: transactional finalize by Stripe session,
 * re-export webhook processing, and post-commit confirmation emails.
 */
const { runWithTransaction } = require('../db/transaction');
// Destructure object properties into local variables.
const { finalizeReservationCore } = require('./bookingFinalization/finalizeReservationCore');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  processStripeWebhookEvent,
// Continue the surrounding logic with this statement.
} = require('./bookingFinalization/webhookEventProcessingService');
// Destructure object properties into local variables.
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
  // Reserve the result variable for later assignment.
  let result;

  // Open a DB transaction so writes commit atomically.
  await runWithTransaction(async (client) => {
    // Store the awaited result in result.
    result = await finalizeReservationCore(stripeSessionId, options, client);
  });

  // Call sendEmailsAfterCommit to perform this step.
  sendEmailsAfterCommit(result);
  // Return the resulting value to the caller.
  return result;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  finalizeReservationByStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  processStripeWebhookEvent,
  // Contribute this line to the enclosing declaration or statement.
  sendEmailsAfterCommit,
};
