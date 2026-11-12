/**
 * Query-string validation for the admin payment refund queue.
 */
const { query } = require('express-validator');
// Destructure object properties into local variables.
const { REFUNDABLE_STATUSES } = require('../services/payment/refund/refundPolicy');

// Create the iso date constant.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Create the admin payment refund queue validation rules constant.
const adminPaymentRefundQueueValidationRules = [
  // Call query to perform this step.
  query('q')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isString to perform this step.
    .isString()
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 40 })
    // Call .withMessage to perform this step.
    .withMessage('Search query must be at most 40 characters.'),
  // Call query to perform this step.
  query('status')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isIn to perform this step.
    .isIn([...REFUNDABLE_STATUSES])
    // Call .withMessage to perform this step.
    .withMessage('Invalid reservation status.'),
  // Call query to perform this step.
  query('refundState')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isIn to perform this step.
    .isIn(['none', 'pending', 'failed'])
    // Call .withMessage to perform this step.
    .withMessage('Invalid refund state.'),
  // Call query to perform this step.
  query('pickupFrom')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .matches to perform this step.
    .matches(ISO_DATE)
    // Call .withMessage to perform this step.
    .withMessage('Invalid pickup from date.'),
  // Call query to perform this step.
  query('pickupTo')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .matches to perform this step.
    .matches(ISO_DATE)
    // Call .withMessage to perform this step.
    .withMessage('Invalid pickup to date.'),
  // Call query to perform this step.
  query('limit')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isInt to perform this step.
    .isInt({ min: 1, max: 50 })
    // Call .withMessage to perform this step.
    .withMessage('Limit must be between 1 and 50.'),
];

// Assign the CommonJS module exports.
module.exports = { adminPaymentRefundQueueValidationRules };
