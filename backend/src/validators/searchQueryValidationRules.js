/**
 * Query-string validation for the public car search booking window.
 */
const { query } = require('express-validator');
// Destructure object properties into local variables.
const { validateBookingDates } = require('../utils/bookingValidation');
// Destructure object properties into local variables.
const { ALLOWED_LOCATIONS } = require('../constants/locations');
// Destructure object properties into local variables.
const { queryTimeRule } = require('./timeFieldRules');

// Create the iso date constant.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Create the search query validation rules constant.
const searchQueryValidationRules = [
  // Call query to perform this step.
  query('pickup-date')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Please choose a pick-up date.')
    // Call .matches to perform this step.
    .matches(ISO_DATE)
    // Call .withMessage to perform this step.
    .withMessage('Invalid pick-up date format.'),
  // Call query to perform this step.
  query('return-date')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Please choose a return date.')
    // Call .matches to perform this step.
    .matches(ISO_DATE)
    // Call .withMessage to perform this step.
    .withMessage('Invalid return date format.'),
  // Call queryTimeRule to perform this step.
  queryTimeRule('pickup-time', {
    // Provide the required field value.
    required: true,
    // Provide the empty message field value.
    emptyMessage: 'Please choose a pick-up time.',
    // Provide the format message field value.
    formatMessage: 'Pick-up time must be in HH:MM format.',
  }),
  // Call queryTimeRule to perform this step.
  queryTimeRule('return-time', {
    // Provide the required field value.
    required: true,
    // Provide the empty message field value.
    emptyMessage: 'Please choose a return time.',
    // Provide the format message field value.
    formatMessage: 'Return time must be in HH:MM format.',
  }),
  // Call query to perform this step.
  query('pickup-location')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Please choose a pick-up location.')
    // Call .isIn to perform this step.
    .isIn(ALLOWED_LOCATIONS)
    // Call .withMessage to perform this step.
    .withMessage('Invalid pick-up location.'),
  // Call query to perform this step.
  query('return-location')
    // Call .notEmpty to perform this step.
    .notEmpty()
    // Call .withMessage to perform this step.
    .withMessage('Please choose a return location.')
    // Call .isIn to perform this step.
    .isIn(ALLOWED_LOCATIONS)
    // Call .withMessage to perform this step.
    .withMessage('Invalid return location.'),
  // Call query to perform this step.
  query().custom((_, { req }) => {
    // Create the result constant.
    const result = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: req.query['pickup-date'],
      // Provide the return date field value.
      returnDate: req.query['return-date'],
      // Provide the pickup time field value.
      pickupTime: req.query['pickup-time'] || '10:00',
      // Provide the return time field value.
      returnTime: req.query['return-time'] || '10:00',
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
module.exports = { searchQueryValidationRules };
