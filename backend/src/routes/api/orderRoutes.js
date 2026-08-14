const express = require('express');
const orderController = require('../../controllers/api/orderController');
const { orderBodyValidationRules } = require('../../validators/orderBodyValidationRules');

const router = express.Router();

router.post('/', orderBodyValidationRules, orderController.createOrder);

module.exports = router;
