/**
 * Body validation for replacing an existing session hold (rehold).
 */
const { body } = require('express-validator');
// Destructure object properties into local variables.
const { ALLOWED_LOCATIONS } = require('../constants/locations');
// Destructure object properties into local variables.
const { bodyTimeRule } = require('./timeFieldRules');

// Create the rehold body validation rules constant.
const reholdBodyValidationRules = [
  // Call body to perform this step.
  body('carId')
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Invalid car id.'),
  // Call body to perform this step.
  body('pickupDate')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Pickup date is required.'),
  // Call body to perform this step.
  body('returnDate')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Return date is required.'),
  // Call bodyTimeRule to perform this step.
  bodyTimeRule('pickupTime', { message: 'Pickup time must be in HH:MM format.' }),
  // Call bodyTimeRule to perform this step.
  bodyTimeRule('returnTime', { message: 'Return time must be in HH:MM format.' }),
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
];

// Assign the CommonJS module exports.
module.exports = { reholdBodyValidationRules };
