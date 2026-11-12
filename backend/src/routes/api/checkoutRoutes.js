/**
 * Stripe checkout session create, success callback, and cancel endpoints.
 */
const express = require('express');
// Require the '../../controllers/api/checkoutController' module as checkoutController.
const checkoutController = require('../../controllers/api/checkoutController');
// Require the '../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../middleware/validateRequest');
// Destructure object properties into local variables.
const { checkoutBodyValidationRules } = require('../../validators/checkoutBodyValidationRules');
// Destructure object properties into local variables.
const { checkoutSuccessQueryValidationRules } = require('../../validators/checkoutSuccessQueryValidationRules');
// Destructure object properties into local variables.
const { orderBodyValidationRules } = require('../../validators/orderBodyValidationRules');

// Create the router constant.
const router = express.Router();

// Create Stripe Checkout Session for the active hold/order.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/',
  // Contribute this line to the enclosing declaration or statement.
  [...orderBodyValidationRules, ...checkoutBodyValidationRules],
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  checkoutController.createCheckoutSession
);
// Browser return URL after successful payment (sync session → paid).
router.get(
  // Supply the literal value used by the enclosing expression.
  '/success',
  // Contribute this line to the enclosing declaration or statement.
  checkoutSuccessQueryValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  checkoutController.handleCheckoutSuccess
);
// Explicit cancel from Checkout UI (release / mark abandoned).
router.post('/cancel', checkoutController.handleCheckoutCancel);

// Assign the CommonJS module exports.
module.exports = router;
