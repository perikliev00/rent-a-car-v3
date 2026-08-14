const { body, param } = require('express-validator');

const accountTravelValidationRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid reservation id.'),
  body('flightNumber')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 64 })
    .withMessage('Flight number is too long.'),
  body('hotelName')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Hotel name is too long.'),
  body('address')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Address is too long.'),
  body('specialRequests')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 4000 })
    .withMessage('Special requests are too long.'),
];

const accountCancelRequestValidationRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid reservation id.'),
  body('reason')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Reason is too long.'),
];

const accountDocumentUploadValidationRules = [
  body('docType')
    .isIn(['driver_license', 'passport_id', 'other'])
    .withMessage('Document type must be driver_license, passport_id, or other.'),
  body('reservationId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Invalid reservation id.'),
];

const accountPdfKindValidationRules = [
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
  accountTravelValidationRules,
  accountCancelRequestValidationRules,
  accountDocumentUploadValidationRules,
  accountPdfKindValidationRules,
};
