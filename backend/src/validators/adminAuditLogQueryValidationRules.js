const { query } = require('express-validator');

const adminAuditLogQueryValidationRules = [
  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer')
    .toInt(),
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt(),
  query('from')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('from must be a valid ISO date'),
  query('to')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('to must be a valid ISO date'),
  query('actorType')
    .optional({ values: 'falsy' })
    .isIn(['admin', 'system', 'customer'])
    .withMessage('actorType must be admin, system, or customer'),
  query('actionPrefix')
    .optional({ values: 'falsy' })
    .isIn(['admin', 'system', 'customer'])
    .withMessage('actionPrefix must be admin, system, or customer'),
  query('action')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('action is invalid'),
  query('adminUserId')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('adminUserId must be a positive integer')
    .toInt(),
  query('entityType')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('entityType is invalid'),
  query('entityId')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('entityId is invalid'),
];

module.exports = {
  adminAuditLogQueryValidationRules,
};
