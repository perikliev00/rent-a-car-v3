/**
 * Query-string validation for the admin order list filters.
 */
const { query } = require('express-validator');
// Destructure object properties into local variables.
const { ALLOWED_STATUSES } = require('../services/sql/orderSqlService');

// Create the iso date constant.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Create the admin order list query validation rules constant.
const adminOrderListQueryValidationRules = [
  // Call query to perform this step.
  query('status')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isIn to perform this step.
    .isIn(ALLOWED_STATUSES)
    // Call .withMessage to perform this step.
    .withMessage('Invalid order status.'),
  // Call query to perform this step.
  query('startDate')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .matches to perform this step.
    .matches(ISO_DATE)
    // Call .withMessage to perform this step.
    .withMessage('Invalid start date format.'),
  // Call query to perform this step.
  query('endDate')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .matches to perform this step.
    .matches(ISO_DATE)
    // Call .withMessage to perform this step.
    .withMessage('Invalid end date format.'),
  // Call query to perform this step.
  query('search')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isString to perform this step.
    .isString()
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 200 })
    // Call .withMessage to perform this step.
    .withMessage('Search query must be at most 200 characters.'),
];

// Assign the CommonJS module exports.
module.exports = { adminOrderListQueryValidationRules };
