/**
 * Query validation for the checkout success callback (session_id).
 */
const { query } = require('express-validator');

// Create the checkout success query validation rules constant.
const checkoutSuccessQueryValidationRules = [
  // Call query to perform this step.
  query('session_id')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Checkout session id is required.')
    // Call .matches to perform this step.
    .matches(/^cs_(test|live)_[A-Za-z0-9]+$/)
    // Call .withMessage to perform this step.
    .withMessage('Invalid checkout session id.'),
];

// Assign the CommonJS module exports.
module.exports = { checkoutSuccessQueryValidationRules };
