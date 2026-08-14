const { handleStripeWebhookFlow } = require('../services/payment/webhookService');
const asyncHandler = require('../utils/asyncHandler');

exports.handleStripeWebhook = asyncHandler(async (req, res) => {
  const result = await handleStripeWebhookFlow(req);
  return res.status(result.statusCode).json(result.body);
});
