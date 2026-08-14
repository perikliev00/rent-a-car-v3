const { body } = require('express-validator');

const authLoginValidationRules = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password must be at most 128 characters'),
];

module.exports = { authLoginValidationRules };
