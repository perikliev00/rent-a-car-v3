const { body } = require('express-validator');
const { ALLOWED_LOCATIONS } = require('../constants/locations');
const { bodyTimeRule } = require('./timeFieldRules');

const orderBodyValidationRules = [
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
];

module.exports = { orderBodyValidationRules };
