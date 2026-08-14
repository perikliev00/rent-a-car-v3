const { body } = require('express-validator');
const { ALLOWED_LOCATIONS } = require('../constants/locations');
const { bodyTimeRule } = require('./timeFieldRules');

const reholdBodyValidationRules = [
  body('carId')
    .isInt({ min: 1 })
    .withMessage('Invalid car id.'),
  body('pickupDate')
    .notEmpty()
    .withMessage('Pickup date is required.'),
  body('returnDate')
    .notEmpty()
    .withMessage('Return date is required.'),
  bodyTimeRule('pickupTime', { message: 'Pickup time must be in HH:MM format.' }),
  bodyTimeRule('returnTime', { message: 'Return time must be in HH:MM format.' }),
  body('pickupLocation')
    .isIn(ALLOWED_LOCATIONS)
    .withMessage('Invalid pickup location.'),
  body('returnLocation')
    .isIn(ALLOWED_LOCATIONS)
    .withMessage('Invalid return location.'),
];

module.exports = { reholdBodyValidationRules };
