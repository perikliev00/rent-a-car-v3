/**
 * Path-param validation for admin order :id.
 */
const { param } = require('express-validator');

// Create the admin order id param validation constant.
const adminOrderIdParamValidation = [
  // Call param to perform this step.
  param('id')
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Invalid order id.'),
];

// Assign the CommonJS module exports.
module.exports = { adminOrderIdParamValidation };
