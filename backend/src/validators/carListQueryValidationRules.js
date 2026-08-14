const { query } = require('express-validator');
const {
  FUEL_TYPES,
  TRANSMISSIONS,
  CAR_SEATS_MIN,
  CAR_SEATS_MAX,
} = require('../constants/carEnums');

const carListQueryValidationRules = [
  query('page')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer.'),
  query('categoryId')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Invalid category id.'),
  query('category')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Invalid category id.'),
  query('transmission')
    .optional({ checkFalsy: true })
    .isIn(TRANSMISSIONS)
    .withMessage('Invalid transmission.'),
  query('fuelType')
    .optional({ checkFalsy: true })
    .isIn(FUEL_TYPES)
    .withMessage('Invalid fuel type.'),
  query('seatsMin')
    .optional({ checkFalsy: true })
    .isInt({ min: CAR_SEATS_MIN, max: CAR_SEATS_MAX })
    .withMessage(`seatsMin must be an integer between ${CAR_SEATS_MIN} and ${CAR_SEATS_MAX}.`),
  query('seatsMax')
    .optional({ checkFalsy: true })
    .isInt({ min: CAR_SEATS_MIN, max: CAR_SEATS_MAX })
    .withMessage(`seatsMax must be an integer between ${CAR_SEATS_MIN} and ${CAR_SEATS_MAX}.`),
  query('priceMin')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('priceMin must be a non-negative number.'),
  query('priceMax')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('priceMax must be a non-negative number.'),
];

module.exports = { carListQueryValidationRules };
