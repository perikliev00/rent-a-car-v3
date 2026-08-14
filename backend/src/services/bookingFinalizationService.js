const { runWithTransaction } = require('../db/transaction');
const { finalizeReservationCore } = require('./bookingFinalization/finalizeReservationCore');
const {
  processStripeWebhookEvent,
} = require('./bookingFinalization/webhookEventProcessingService');
const { sendEmailsAfterCommit } = require('./bookingFinalization/sendEmailsAfterCommit');

async function finalizeReservationByStripeSessionId(stripeSessionId, options = {}) {
  let result;

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
