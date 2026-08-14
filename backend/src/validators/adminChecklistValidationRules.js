const { body, param } = require('express-validator');

const adminChecklistValidationRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid reservation id.'),
  body('fuelLevel')
    .isIn(['empty', 'quarter', 'half', 'three_quarters', 'full'])
    .withMessage('Invalid fuel level.'),
  body('mileage')
    .isInt({ min: 0 })
    .withMessage('Mileage must be a non-negative integer.'),
  body('existingDamages').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
  body('newDamages').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
  body('lateReturn').optional({ nullable: true }),
  body('extraFees').optional({ nullable: true }).isFloat({ min: 0 }),
  body('pickupTime').optional({ nullable: true }).isISO8601(),
  body('returnTime').optional({ nullable: true }).isISO8601(),
];

const adminCancellationReviewValidationRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid request id.'),
  body('approve').exists().withMessage('approve is required.'),
  body('adminNote').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
];

const adminPdfKindValidationRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid reservation id.'),
  param('kind')
    .isIn([
      'rental_agreement',
      'invoice',
      'receipt',
      'damage_report',
      'pickup_checklist',
      'return_checklist',
    ])
    .withMessage('Invalid PDF document kind.'),
];

module.exports = {
  adminChecklistValidationRules,
  adminCancellationReviewValidationRules,
  adminPdfKindValidationRules,
};
