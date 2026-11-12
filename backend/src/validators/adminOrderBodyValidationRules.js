/**
 * Body validation for admin order create/update and empty-deleted-orders confirm.
 */
const { body } = require('express-validator');
// Destructure object properties into local variables.
const { ALLOWED_LOCATIONS } = require('../constants/locations');
// Destructure object properties into local variables.
const { bodyTimeRule } = require('./timeFieldRules');

// Create the admin order body validation rules constant.
const adminOrderBodyValidationRules = [
  // Call body to perform this step.
  body('carId')
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Invalid car id.'),
  // Call body to perform this step.
  body('pickupDate')
    // Call .isISO8601 to perform this step.
    .isISO8601()
    // Call .withMessage to perform this step.
    .withMessage('Invalid pickup date.'),
  // Call body to perform this step.
  body('returnDate')
    // Call .isISO8601 to perform this step.
    .isISO8601()
    // Call .withMessage to perform this step.
    .withMessage('Invalid return date.'),
  // Call body to perform this step.
  body('pickupLocation')
    // Call .isIn to perform this step.
    .isIn(ALLOWED_LOCATIONS)
    // Call .withMessage to perform this step.
    .withMessage('Invalid pickup location.'),
  // Call body to perform this step.
  body('returnLocation')
    // Call .isIn to perform this step.
    .isIn(ALLOWED_LOCATIONS)
    // Call .withMessage to perform this step.
    .withMessage('Invalid return location.'),
  // Call bodyTimeRule to perform this step.
  bodyTimeRule('pickupTime', { message: 'Pickup time must be in HH:MM format.' }),
  // Call bodyTimeRule to perform this step.
  bodyTimeRule('returnTime', { message: 'Return time must be in HH:MM format.' }),
  // Call body to perform this step.
  body('fullName').notEmpty().withMessage('Full name is required.'),
  // Call body to perform this step.
  body('phoneNumber')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Phone number is required.')
    // Call .isMobilePhone to perform this step.
    .isMobilePhone('any')
    // Call .withMessage to perform this step.
    .withMessage('Please enter a valid phone number.'),
  // Call body to perform this step.
  body('email')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Email is required.')
    // Call .isEmail to perform this step.
    .isEmail()
    // Call .withMessage to perform this step.
    .withMessage('Please enter a valid email address.'),
  // Call body to perform this step.
  body('address').notEmpty().withMessage('Address is required.'),
  // Call body to perform this step.
  body('hotelName').optional({ checkFalsy: true }).trim(),
];

// Create the empty deleted orders confirm constant.
const EMPTY_DELETED_ORDERS_CONFIRM = 'EMPTY DELETED ORDERS';

// Create the admin empty deleted orders validation rules constant.
const adminEmptyDeletedOrdersValidationRules = [
  // Call body to perform this step.
  body('confirmText')
    // Call .equals to perform this step.
    .equals(EMPTY_DELETED_ORDERS_CONFIRM)
    // Call .withMessage to perform this step.
    .withMessage(`Type "${EMPTY_DELETED_ORDERS_CONFIRM}" to confirm permanent deletion.`),
];

// Create the admin payment reconcile validation rules constant.
const adminPaymentReconcileValidationRules = [
  // Call body to perform this step.
  body('dryRun').optional().isBoolean().withMessage('dryRun must be a boolean.'),
];

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  adminOrderBodyValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  adminEmptyDeletedOrdersValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  adminPaymentReconcileValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  EMPTY_DELETED_ORDERS_CONFIRM,
};
