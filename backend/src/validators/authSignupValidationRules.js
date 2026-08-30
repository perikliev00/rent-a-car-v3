const { body } = require('express-validator');

const signupPasswordRules = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be between 8 and 128 characters')
  .matches(/[A-Za-z]/)
  .withMessage('Password must contain at least one letter')
  .matches(/\d/)
  .withMessage('Password must contain at least one number');

const authSignupValidationRules = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  signupPasswordRules,
];

const authVerifyEmailValidationRules = [
  body('token')
    .trim()
    .isLength({ min: 16, max: 128 })
    .withMessage('A valid verification token is required')
    .matches(/^[a-fA-F0-9]+$/)
    .withMessage('A valid verification token is required'),
];

module.exports = { authSignupValidationRules, authVerifyEmailValidationRules };
