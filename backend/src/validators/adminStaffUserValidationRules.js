const { body } = require('express-validator');

const staffEmailRule = body('email')
  .trim()
  .isEmail()
  .withMessage('Please enter a valid email address')
  .normalizeEmail();

const adminStaffCreateValidationRules = [
  staffEmailRule,
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters'),
  body('roleIds')
    .isArray({ min: 1 })
    .withMessage('At least one role is required'),
];

const adminStaffUpdateValidationRules = [staffEmailRule];

module.exports = {
  adminStaffCreateValidationRules,
  adminStaffUpdateValidationRules,
};
