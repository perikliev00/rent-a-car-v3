/**
 * Body validation for the public contact form submission.
 */
const { body } = require('express-validator');

// Create the contact body validation rules constant.
const contactBodyValidationRules = [
  // Call body to perform this step.
  body('name')
    // Call .trim to perform this step.
    .trim()
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Please enter your name')
    // Call .isLength to perform this step.
    .isLength({ max: 255 })
    // Call .withMessage to perform this step.
    .withMessage('Name must be at most 255 characters'),
  // Call body to perform this step.
  body('email')
    // Call .trim to perform this step.
    .trim()
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Please enter your email')
    // Call .isEmail to perform this step.
    .isEmail()
    // Call .withMessage to perform this step.
    .withMessage('Please enter a valid email address')
    // Call .isLength to perform this step.
    .isLength({ max: 255 })
    // Call .withMessage to perform this step.
    .withMessage('Email must be at most 255 characters')
    // Call .normalizeEmail to perform this step.
    .normalizeEmail(),
  // Call body to perform this step.
  body('phone')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 50 })
    // Call .withMessage to perform this step.
    .withMessage('Phone must be at most 50 characters'),
  // Call body to perform this step.
  body('subject')
    // Call .trim to perform this step.
    .trim()
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Please enter a subject')
    // Call .isLength to perform this step.
    .isLength({ max: 255 })
    // Call .withMessage to perform this step.
    .withMessage('Subject must be at most 255 characters'),
  // Call body to perform this step.
  body('message')
    // Call .trim to perform this step.
    .trim()
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Please enter a message')
    // Call .isLength to perform this step.
    .isLength({ min: 10, max: 5000 })
    // Call .withMessage to perform this step.
    .withMessage('Message must be between 10 and 5000 characters'),
];

// Assign the CommonJS module exports.
module.exports = { contactBodyValidationRules };
