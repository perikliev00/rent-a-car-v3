/**
 * Stripe checkout session create, success callback, and cancel endpoints.
 */
const express = require('express');
const checkoutController = require('../../controllers/api/checkoutController');
const validateRequest = require('../../middleware/validateRequest');
const { checkoutBodyValidationRules } = require('../../validators/checkoutBodyValidationRules');
const { checkoutSuccessQueryValidationRules } = require('../../validators/checkoutSuccessQueryValidationRules');
const { orderBodyValidationRules } = require('../../validators/orderBodyValidationRules');

const router = express.Router();

// Create Stripe Checkout Session for the active hold/order.
router.post(
  '/',
  [...orderBodyValidationRules, ...checkoutBodyValidationRules],
  validateRequest,
  checkoutController.createCheckoutSession
);
// Browser return URL after successful payment (sync session → paid).
router.get(
  '/success',
  checkoutSuccessQueryValidationRules,
  validateRequest,
  checkoutController.handleCheckoutSuccess
);
// Explicit cancel from Checkout UI (release / mark abandoned).
router.post('/cancel', checkoutController.handleCheckoutCancel);

module.exports = router;
