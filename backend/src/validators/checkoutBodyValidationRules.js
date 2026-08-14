const { body } = require('express-validator');

const checkoutBodyValidationRules = [
  body('fullName').notEmpty().withMessage('Please enter your full name'),
  body('phoneNumber')
    .notEmpty()
    .withMessage('Please enter your phone number')
    .isMobilePhone('any')
    .withMessage('Please enter a valid phone number'),
  body('email')
    .notEmpty()
    .withMessage('Please enter your email')
    .isEmail()
    .withMessage('Please enter a valid email address'),
  body('address').notEmpty().withMessage('Please enter your address'),
  body('hotelName').optional({ checkFalsy: true }).trim(),
];

module.exports = { checkoutBodyValidationRules };
