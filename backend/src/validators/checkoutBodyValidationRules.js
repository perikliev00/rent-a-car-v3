/**
 * Body validation for Stripe checkout customer contact fields.
 */
const { body } = require('express-validator');

// Create the checkout body validation rules constant.
const checkoutBodyValidationRules = [
  // Call body to perform this step.
  body('fullName').notEmpty().withMessage('Please enter your full name'),
  // Call body to perform this step.
  body('phoneNumber')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Please enter your phone number')
    // Call .isMobilePhone to perform this step.
    .isMobilePhone('any')
    // Call .withMessage to perform this step.
    .withMessage('Please enter a valid phone number'),
  // Call body to perform this step.
  body('email')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Please enter your email')
    // Call .isEmail to perform this step.
    .isEmail()
    // Call .withMessage to perform this step.
    .withMessage('Please enter a valid email address'),
  // Call body to perform this step.
  body('address').notEmpty().withMessage('Please enter your address'),
  // Call body to perform this step.
  body('hotelName').optional({ checkFalsy: true }).trim(),
];

// Assign the CommonJS module exports.
module.exports = { checkoutBodyValidationRules };
