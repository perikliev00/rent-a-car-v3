/**
 * express-validator chains for analytics date-range and car id params.
 */

const { query, param } = require('express-validator');

/** Inclusive YYYY-MM-DD from/to query pair. */
const dateRangeQuery = [
  // Call query to perform this step.
  query('from')
    // Call .matches to perform this step.
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    // Call .withMessage to perform this step.
    .withMessage('from must be YYYY-MM-DD'),
  // Call query to perform this step.
  query('to')
    // Call .matches to perform this step.
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    // Call .withMessage to perform this step.
    .withMessage('to must be YYYY-MM-DD'),
];

// Create the limit query constant.
const limitQuery = [
  // Call query to perform this step.
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

// Create the car id param constant.
const carIdParam = [param('carId').isInt({ min: 1 }).withMessage('Invalid car id')];

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  dateRangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  limitQuery,
  // Contribute this line to the enclosing declaration or statement.
  carIdParam,
};
