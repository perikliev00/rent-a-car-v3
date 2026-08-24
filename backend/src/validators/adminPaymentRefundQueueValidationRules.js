const { query } = require('express-validator');
const { REFUNDABLE_STATUSES } = require('../services/payment/refund/refundPolicy');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const adminPaymentRefundQueueValidationRules = [
  query('q')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 40 })
    .withMessage('Search query must be at most 40 characters.'),
  query('status')
    .optional({ checkFalsy: true })
    .isIn([...REFUNDABLE_STATUSES])
    .withMessage('Invalid reservation status.'),
  query('refundState')
    .optional({ checkFalsy: true })
    .isIn(['none', 'pending', 'failed'])
    .withMessage('Invalid refund state.'),
  query('pickupFrom')
    .optional({ checkFalsy: true })
    .matches(ISO_DATE)
    .withMessage('Invalid pickup from date.'),
  query('pickupTo')
    .optional({ checkFalsy: true })
    .matches(ISO_DATE)
    .withMessage('Invalid pickup to date.'),
  query('limit')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50.'),
];

module.exports = { adminPaymentRefundQueueValidationRules };
