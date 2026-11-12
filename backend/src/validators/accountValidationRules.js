/**
 * express-validator rules for customer account travel details and cancel requests.
 */
const { body, param } = require('express-validator');

// Create the account travel validation rules constant.
const accountTravelValidationRules = [
  // Call param to perform this step.
  param('id').isInt({ min: 1 }).withMessage('Invalid reservation id.'),
  // Call body to perform this step.
  body('flightNumber')
    // Call .optional to perform this step.
    .optional({ nullable: true })
    // Call .isString to perform this step.
    .isString()
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 64 })
    // Call .withMessage to perform this step.
    .withMessage('Flight number is too long.'),
  // Call body to perform this step.
  body('hotelName')
    // Call .optional to perform this step.
    .optional({ nullable: true })
    // Call .isString to perform this step.
    .isString()
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 255 })
    // Call .withMessage to perform this step.
    .withMessage('Hotel name is too long.'),
  // Call body to perform this step.
  body('address')
    // Call .optional to perform this step.
    .optional({ nullable: true })
    // Call .isString to perform this step.
    .isString()
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 2000 })
    // Call .withMessage to perform this step.
    .withMessage('Address is too long.'),
  // Call body to perform this step.
  body('specialRequests')
    // Call .optional to perform this step.
    .optional({ nullable: true })
    // Call .isString to perform this step.
    .isString()
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 4000 })
    // Call .withMessage to perform this step.
    .withMessage('Special requests are too long.'),
];

// Create the account cancel request validation rules constant.
const accountCancelRequestValidationRules = [
  // Call param to perform this step.
  param('id').isInt({ min: 1 }).withMessage('Invalid reservation id.'),
  // Call body to perform this step.
  body('reason')
    // Call .optional to perform this step.
    .optional({ nullable: true })
    // Call .isString to perform this step.
    .isString()
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ max: 2000 })
    // Call .withMessage to perform this step.
    .withMessage('Reason is too long.'),
];

// Create the account document upload validation rules constant.
const accountDocumentUploadValidationRules = [
  // Call body to perform this step.
  body('docType')
    // Call .isIn to perform this step.
    .isIn(['driver_license', 'passport_id', 'other'])
    // Call .withMessage to perform this step.
    .withMessage('Document type must be driver_license, passport_id, or other.'),
  // Call body to perform this step.
  body('reservationId')
    // Call .optional to perform this step.
    .optional({ nullable: true })
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Invalid reservation id.'),
];

// Create the account pdf kind validation rules constant.
const accountPdfKindValidationRules = [
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
  accountTravelValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  accountCancelRequestValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  accountDocumentUploadValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  accountPdfKindValidationRules,
};
