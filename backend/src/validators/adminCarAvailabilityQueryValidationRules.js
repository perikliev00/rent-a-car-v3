/**
 * Admin car availability query validation (pickup/return dates and times).
 */
const { query } = require('express-validator');
// Destructure object properties into local variables.
const { validateBookingDates } = require('../utils/bookingValidation');
// Destructure object properties into local variables.
const { queryTimeRule } = require('./timeFieldRules');

// Create the iso date constant.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Create the admin car availability query validation rules constant.
const adminCarAvailabilityQueryValidationRules = [
  // Call query to perform this step.
  query('pickupDate')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Pick-up date is required.')
    // Call .matches to perform this step.
    .matches(ISO_DATE)
    // Call .withMessage to perform this step.
    .withMessage('Invalid pick-up date format.'),
  // Call query to perform this step.
  query('returnDate')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Return date is required.')
    // Call .matches to perform this step.
    .matches(ISO_DATE)
    // Call .withMessage to perform this step.
    .withMessage('Invalid return date format.'),
  // Call queryTimeRule to perform this step.
  queryTimeRule('pickupTime', {
    // Provide the required field value.
    required: false,
    // Provide the format message field value.
    formatMessage: 'Pick-up time must be in HH:MM format.',
  }),
  // Call queryTimeRule to perform this step.
  queryTimeRule('returnTime', {
    // Provide the required field value.
    required: false,
    // Provide the format message field value.
    formatMessage: 'Return time must be in HH:MM format.',
  }),
  // Call query to perform this step.
  query().custom((_, { req }) => {
    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: req.query.pickupDate,
      // Provide the return date field value.
      returnDate: req.query.returnDate,
      // Provide the pickup time field value.
      pickupTime: req.query.pickupTime || '10:00',
      // Provide the return time field value.
      returnTime: req.query.returnTime || '10:00',
    });

    // Evaluate the condition and enter the branch when it is true.
    if (!result.isValid) {
      // Throw an error to stop the current control flow.
      throw new Error(result.errors[0]);
    }

    // Return the resulting value to the caller.
    return true;
  }),
];

// Assign the CommonJS module exports.
module.exports = { adminCarAvailabilityQueryValidationRules };
