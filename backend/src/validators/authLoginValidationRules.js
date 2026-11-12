/**
 * Body validation for customer/admin login credentials.
 */
const { body } = require('express-validator');

// Create the auth login validation rules constant.
const authLoginValidationRules = [
  // Call body to perform this step.
  body('email')
    // Call .trim to perform this step.
    .trim()
    // Call .isEmail to perform this step.
    .isEmail()
    // Call .withMessage to perform this step.
    .withMessage('Please enter a valid email address')
    // Call .normalizeEmail to perform this step.
    .normalizeEmail(),
  // Call body to perform this step.
  body('password')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Password is required')
    // Call .isLength to perform this step.
    .isLength({ max: 128 })
    // Call .withMessage to perform this step.
    .withMessage('Password must be at most 128 characters'),
];

// Assign the CommonJS module exports.
module.exports = { authLoginValidationRules };
