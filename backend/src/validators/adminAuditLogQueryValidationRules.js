/**
 * Query-string validation for the admin audit log list endpoint.
 */
const { query } = require('express-validator');

// Create the admin audit log query validation rules constant.
const adminAuditLogQueryValidationRules = [
  // Call query to perform this step.
  query('page')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('page must be a positive integer')
    // Call .toInt to perform this step.
    .toInt(),
  // Call query to perform this step.
  query('limit')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .isInt to perform this step.
    .isInt({ min: 1, max: 100 })
    // Call .withMessage to perform this step.
    .withMessage('limit must be between 1 and 100')
    // Call .toInt to perform this step.
    .toInt(),
  // Call query to perform this step.
  query('from')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .isISO8601 to perform this step.
    .isISO8601()
    // Call .withMessage to perform this step.
    .withMessage('from must be a valid ISO date'),
  // Call query to perform this step.
  query('to')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .isISO8601 to perform this step.
    .isISO8601()
    // Call .withMessage to perform this step.
    .withMessage('to must be a valid ISO date'),
  // Call query to perform this step.
  query('actorType')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .isIn to perform this step.
    .isIn(['admin', 'system', 'customer'])
    // Call .withMessage to perform this step.
    .withMessage('actorType must be admin, system, or customer'),
  // Call query to perform this step.
  query('actionPrefix')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .isIn to perform this step.
    .isIn(['admin', 'system', 'customer'])
    // Call .withMessage to perform this step.
    .withMessage('actionPrefix must be admin, system, or customer'),
  // Call query to perform this step.
  query('action')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .isString to perform this step.
    .isString()
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 100 })
    // Call .withMessage to perform this step.
    .withMessage('action is invalid'),
  // Call query to perform this step.
  query('adminUserId')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('adminUserId must be a positive integer')
    // Call .toInt to perform this step.
    .toInt(),
  // Call query to perform this step.
  query('entityType')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .isString to perform this step.
    .isString()
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 50 })
    // Call .withMessage to perform this step.
    .withMessage('entityType is invalid'),
  // Call query to perform this step.
  query('entityId')
    // Call .optional to perform this step.
    .optional({ values: 'falsy' })
    // Call .isString to perform this step.
    .isString()
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 255 })
    // Call .withMessage to perform this step.
    .withMessage('entityId is invalid'),
];

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  adminAuditLogQueryValidationRules,
};
