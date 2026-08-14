const { query } = require('express-validator');

const checkoutSuccessQueryValidationRules = [
  query('session_id')
    .notEmpty()
    .withMessage('Checkout session id is required.')
    .matches(/^cs_(test|live)_[A-Za-z0-9]+$/)
    .withMessage('Invalid checkout session id.'),
];

module.exports = { checkoutSuccessQueryValidationRules };
