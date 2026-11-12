/**
 * Path-param validation for admin contact message :id.
 */
const { param } = require('express-validator');

// Create the admin contact id param validation constant.
const adminContactIdParamValidation = [
  // Call param to perform this step.
  param('id')
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Invalid contact id.'),
];

// Assign the CommonJS module exports.
module.exports = { adminContactIdParamValidation };
