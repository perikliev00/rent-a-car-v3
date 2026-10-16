/**
 * Customer order creation endpoint (places a hold / draft order before checkout).
 */
const express = require('express');
const orderController = require('../../controllers/api/orderController');
const { orderBodyValidationRules } = require('../../validators/orderBodyValidationRules');

const router = express.Router();

// Create order + reservation hold from booking form payload.
router.post('/', orderBodyValidationRules, orderController.createOrder);

module.exports = router;
