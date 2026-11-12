/**
 * Customer order creation endpoint (places a hold / draft order before checkout).
 */
const express = require('express');
// Require the '../../controllers/api/orderController' module as orderController.
const orderController = require('../../controllers/api/orderController');
// Destructure object properties into local variables.
const { orderBodyValidationRules } = require('../../validators/orderBodyValidationRules');

// Create the router constant.
const router = express.Router();

// Create order + reservation hold from booking form payload.
router.post('/', orderBodyValidationRules, orderController.createOrder);

// Assign the CommonJS module exports.
module.exports = router;
