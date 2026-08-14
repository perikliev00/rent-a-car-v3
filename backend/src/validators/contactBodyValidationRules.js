const { body } = require('express-validator');

const contactBodyValidationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please enter your name')
    .isLength({ max: 255 })
    .withMessage('Name must be at most 255 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Please enter your email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must be at most 255 characters')
    .normalizeEmail(),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 50 })
    .withMessage('Phone must be at most 50 characters'),
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Please enter a subject')
    .isLength({ max: 255 })
    .withMessage('Subject must be at most 255 characters'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Please enter a message')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters'),
];

module.exports = { contactBodyValidationRules };
