const { body, param } = require('express-validator');

const adminReservationStatusValidationRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid reservation id'),
  body('status').isString().trim().notEmpty().withMessage('status is required'),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 500 }),
];

module.exports = {
  adminReservationStatusValidationRules,
};
