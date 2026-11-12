/**
 * Body validation for customer order/hold create (car, dates, locations, times).
 */
const { body } = require('express-validator');
// Destructure object properties into local variables.
const { ALLOWED_LOCATIONS } = require('../constants/locations');
// Destructure object properties into local variables.
const { bodyTimeRule } = require('./timeFieldRules');

// Create the order body validation rules constant.
const orderBodyValidationRules = [
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
];

// Assign the CommonJS module exports.
module.exports = { orderBodyValidationRules };
