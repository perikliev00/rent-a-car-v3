const { body } = require('express-validator');
const { ALLOWED_LOCATIONS } = require('../constants/locations');
const { bodyTimeRule } = require('./timeFieldRules');

const adminOrderBodyValidationRules = [
  body('carId')
    .isInt({ min: 1 })
    .withMessage('Invalid car id.'),
  body('pickupDate')
    .isISO8601()
    .withMessage('Invalid pickup date.'),
  body('returnDate')
    .isISO8601()
    .withMessage('Invalid return date.'),
  body('pickupLocation')
    .isIn(ALLOWED_LOCATIONS)
    .withMessage('Invalid pickup location.'),
  body('returnLocation')
    .isIn(ALLOWED_LOCATIONS)
    .withMessage('Invalid return location.'),
  bodyTimeRule('pickupTime', { message: 'Pickup time must be in HH:MM format.' }),
  bodyTimeRule('returnTime', { message: 'Return time must be in HH:MM format.' }),
  body('fullName').notEmpty().withMessage('Full name is required.'),
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required.')
    .isMobilePhone('any')
    .withMessage('Please enter a valid phone number.'),
  body('email')
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please enter a valid email address.'),
  body('address').notEmpty().withMessage('Address is required.'),
  body('hotelName').optional({ checkFalsy: true }).trim(),
];

const EMPTY_DELETED_ORDERS_CONFIRM = 'EMPTY DELETED ORDERS';

const adminEmptyDeletedOrdersValidationRules = [
  body('confirmText')
    .equals(EMPTY_DELETED_ORDERS_CONFIRM)
    .withMessage(`Type "${EMPTY_DELETED_ORDERS_CONFIRM}" to confirm permanent deletion.`),
];

const adminPaymentReconcileValidationRules = [
  body('dryRun').optional().isBoolean().withMessage('dryRun must be a boolean.'),
];

module.exports = {
  adminOrderBodyValidationRules,
  adminEmptyDeletedOrdersValidationRules,
  adminPaymentReconcileValidationRules,
  EMPTY_DELETED_ORDERS_CONFIRM,
};
