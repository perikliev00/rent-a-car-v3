/**
 * Path-param validation for admin routes that take a car :id.
 */
const { param } = require('express-validator');

// Create the admin car id param validation constant.
const adminCarIdParamValidation = [
  // Call param to perform this step.
  param('id')
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Invalid car id.'),
];

// Assign the CommonJS module exports.
module.exports = { adminCarIdParamValidation };
