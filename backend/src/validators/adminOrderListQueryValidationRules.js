const { query } = require('express-validator');
const { ALLOWED_STATUSES } = require('../services/sql/orderSqlService');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const adminOrderListQueryValidationRules = [
  query('status')
    .optional({ checkFalsy: true })
    .isIn(ALLOWED_STATUSES)
    .withMessage('Invalid order status.'),
  query('startDate')
    .optional({ checkFalsy: true })
    .matches(ISO_DATE)
    .withMessage('Invalid start date format.'),
  query('endDate')
    .optional({ checkFalsy: true })
    .matches(ISO_DATE)
    .withMessage('Invalid end date format.'),
  query('search')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must be at most 200 characters.'),
];

module.exports = { adminOrderListQueryValidationRules };
