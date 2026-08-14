const { query } = require('express-validator');
const { validateBookingDates } = require('../utils/bookingValidation');
const { ALLOWED_LOCATIONS } = require('../constants/locations');
const { queryTimeRule } = require('./timeFieldRules');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const searchQueryValidationRules = [
  query('pickup-date')
    .notEmpty()
    .withMessage('Please choose a pick-up date.')
    .matches(ISO_DATE)
    .withMessage('Invalid pick-up date format.'),
  query('return-date')
    .notEmpty()
    .withMessage('Please choose a return date.')
    .matches(ISO_DATE)
    .withMessage('Invalid return date format.'),
  queryTimeRule('pickup-time', {
    required: true,
    emptyMessage: 'Please choose a pick-up time.',
    formatMessage: 'Pick-up time must be in HH:MM format.',
  }),
  queryTimeRule('return-time', {
    required: true,
    emptyMessage: 'Please choose a return time.',
    formatMessage: 'Return time must be in HH:MM format.',
  }),
  query('pickup-location')
    .notEmpty()
    .withMessage('Please choose a pick-up location.')
    .isIn(ALLOWED_LOCATIONS)
    .withMessage('Invalid pick-up location.'),
  query('return-location')
    .notEmpty()
    .withMessage('Please choose a return location.')
    .isIn(ALLOWED_LOCATIONS)
    .withMessage('Invalid return location.'),
  query().custom((_, { req }) => {
    const result = validateBookingDates({
      pickupDate: req.query['pickup-date'],
      returnDate: req.query['return-date'],
      pickupTime: req.query['pickup-time'] || '10:00',
      returnTime: req.query['return-time'] || '10:00',
    });

    if (!result.isValid) {
      throw new Error(result.errors[0]);
    }

    return true;
  }),
];

module.exports = { searchQueryValidationRules };
