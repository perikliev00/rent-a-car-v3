const { query } = require('express-validator');
const { validateBookingDates } = require('../utils/bookingValidation');
const { queryTimeRule } = require('./timeFieldRules');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const adminCarAvailabilityQueryValidationRules = [
  query('pickupDate')
    .notEmpty()
    .withMessage('Pick-up date is required.')
    .matches(ISO_DATE)
    .withMessage('Invalid pick-up date format.'),
  query('returnDate')
    .notEmpty()
    .withMessage('Return date is required.')
    .matches(ISO_DATE)
    .withMessage('Invalid return date format.'),
  queryTimeRule('pickupTime', {
    required: false,
    formatMessage: 'Pick-up time must be in HH:MM format.',
  }),
  queryTimeRule('returnTime', {
    required: false,
    formatMessage: 'Return time must be in HH:MM format.',
  }),
  query().custom((_, { req }) => {
    const result = validateBookingDates({
      pickupDate: req.query.pickupDate,
      returnDate: req.query.returnDate,
      pickupTime: req.query.pickupTime || '10:00',
      returnTime: req.query.returnTime || '10:00',
    });

    if (!result.isValid) {
      throw new Error(result.errors[0]);
    }

    return true;
  }),
];

module.exports = { adminCarAvailabilityQueryValidationRules };
