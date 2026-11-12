/**
 * Body/param validation for admin reservation status transitions.
 */
const { body, param } = require('express-validator');

// Create the admin reservation status validation rules constant.
const adminReservationStatusValidationRules = [
  // Call param to perform this step.
  param('id').isInt({ min: 1 }).withMessage('Invalid reservation id'),
  // Call body to perform this step.
  body('status').isString().trim().notEmpty().withMessage('status is required'),
  // Call body to perform this step.
  body('reason').optional({ nullable: true }).isString().isLength({ max: 500 }),
];

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  adminReservationStatusValidationRules,
};
