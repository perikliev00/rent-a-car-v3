const express = require('express');
const checkoutController = require('../../controllers/api/checkoutController');
const validateRequest = require('../../middleware/validateRequest');
const { checkoutBodyValidationRules } = require('../../validators/checkoutBodyValidationRules');
const { checkoutSuccessQueryValidationRules } = require('../../validators/checkoutSuccessQueryValidationRules');
const { orderBodyValidationRules } = require('../../validators/orderBodyValidationRules');

const router = express.Router();

router.post(
  '/',
  [...orderBodyValidationRules, ...checkoutBodyValidationRules],
  validateRequest,
  checkoutController.createCheckoutSession
);
router.get(
  '/success',
  checkoutSuccessQueryValidationRules,
  validateRequest,
  checkoutController.handleCheckoutSuccess
);
router.post('/cancel', checkoutController.handleCheckoutCancel);

module.exports = router;
