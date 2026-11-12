/**
 * Body validation for signup and email-verification token submission.
 */
const { body } = require('express-validator');

// Create the signup password rules constant.
const signupPasswordRules = body('password')
  // Call .isLength to perform this step.
  .isLength({ min: 8, max: 128 })
  // Call .withMessage to perform this step.
  .withMessage('Password must be between 8 and 128 characters')
  // Call .matches to perform this step.
  .matches(/[A-Za-z]/)
  // Call .withMessage to perform this step.
  .withMessage('Password must contain at least one letter')
  // Call .matches to perform this step.
  .matches(/\d/)
  // Call .withMessage to perform this step.
  .withMessage('Password must contain at least one number');

// Create the auth signup validation rules constant.
const authSignupValidationRules = [
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
  // Contribute this line to the enclosing declaration or statement.
  signupPasswordRules,
];

// Create the auth verify email validation rules constant.
const authVerifyEmailValidationRules = [
  // Call body to perform this step.
  body('token')
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ min: 16, max: 128 })
    // Call .withMessage to perform this step.
    .withMessage('A valid verification token is required')
    // Call .matches to perform this step.
    .matches(/^[a-fA-F0-9]+$/)
    // Call .withMessage to perform this step.
    .withMessage('A valid verification token is required'),
];

// Assign the CommonJS module exports.
module.exports = { authSignupValidationRules, authVerifyEmailValidationRules };
