/**
 * Stripe webhook entrypoint; verifies events and delegates payment fulfillment.
 * Mounted on `/webhook/stripe` with raw body parsing (see `server.js`).
 */
const { handleStripeWebhookFlow } = require('../services/payment/webhookService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Verify Stripe webhook signature and process payment-related events.
 * Side effects: may update payments/orders/reservations via the webhook service.
 * @param {import('express').Request} req - Must include raw body + Stripe-Signature header
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>} JSON ack with status from the flow result
 */
exports.handleStripeWebhook = asyncHandler(async (req, res) => {
  const result = await handleStripeWebhookFlow(req);
  return res.status(result.statusCode).json(result.body);
});
