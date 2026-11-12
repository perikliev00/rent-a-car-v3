/**
 * Admin checklist, cancellation-review, and PDF kind validation rules.
 */
const { body, param } = require('express-validator');

// Create the admin checklist validation rules constant.
const adminChecklistValidationRules = [
  // Call param to perform this step.
  param('id').isInt({ min: 1 }).withMessage('Invalid reservation id.'),
  // Call body to perform this step.
  body('fuelLevel')
    // Call .isIn to perform this step.
    .isIn(['empty', 'quarter', 'half', 'three_quarters', 'full'])
    // Call .withMessage to perform this step.
    .withMessage('Invalid fuel level.'),
  // Call body to perform this step.
  body('mileage')
    // Call .isInt to perform this step.
    .isInt({ min: 0 })
    // Call .withMessage to perform this step.
    .withMessage('Mileage must be a non-negative integer.'),
  // Call body to perform this step.
  body('existingDamages').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
  // Call body to perform this step.
  body('newDamages').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
  // Call body to perform this step.
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
  // Call body to perform this step.
  body('lateReturn').optional({ nullable: true }),
  // Call body to perform this step.
  body('extraFees').optional({ nullable: true }).isFloat({ min: 0 }),
  // Call body to perform this step.
  body('pickupTime').optional({ nullable: true }).isISO8601(),
  // Call body to perform this step.
  body('returnTime').optional({ nullable: true }).isISO8601(),
];

// Create the admin cancellation review validation rules constant.
const adminCancellationReviewValidationRules = [
  // Call param to perform this step.
  param('id').isInt({ min: 1 }).withMessage('Invalid request id.'),
  // Call body to perform this step.
  body('approve').exists().withMessage('approve is required.'),
  // Call body to perform this step.
  body('adminNote').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
];

// Create the admin pdf kind validation rules constant.
const adminPdfKindValidationRules = [
  // Call param to perform this step.
  param('id').isInt({ min: 1 }).withMessage('Invalid reservation id.'),
  // Call param to perform this step.
  param('kind')
    // Call .isIn to perform this step.
    .isIn([
      // Supply the literal value used by the enclosing expression.
      'rental_agreement',
      // Supply the literal value used by the enclosing expression.
      'invoice',
      // Supply the literal value used by the enclosing expression.
      'receipt',
      // Supply the literal value used by the enclosing expression.
      'damage_report',
      // Supply the literal value used by the enclosing expression.
      'pickup_checklist',
      // Supply the literal value used by the enclosing expression.
      'return_checklist',
    ])
    // Call .withMessage to perform this step.
    .withMessage('Invalid PDF document kind.'),
];

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  adminChecklistValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  adminCancellationReviewValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  adminPdfKindValidationRules,
};
