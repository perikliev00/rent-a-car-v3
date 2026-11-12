/**
 * Query-string validation for public car gallery/list filters and pagination.
 */
const { query } = require('express-validator');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  FUEL_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  TRANSMISSIONS,
  // Contribute this line to the enclosing declaration or statement.
  CAR_SEATS_MIN,
  // Contribute this line to the enclosing declaration or statement.
  CAR_SEATS_MAX,
// Continue the surrounding logic with this statement.
} = require('../constants/carEnums');

// Create the car list query validation rules constant.
const carListQueryValidationRules = [
  // Call query to perform this step.
  query('page')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Page must be a positive integer.'),
  // Call query to perform this step.
  query('categoryId')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Invalid category id.'),
  // Call query to perform this step.
  query('category')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Invalid category id.'),
  // Call query to perform this step.
  query('transmission')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isIn to perform this step.
    .isIn(TRANSMISSIONS)
    // Call .withMessage to perform this step.
    .withMessage('Invalid transmission.'),
  // Call query to perform this step.
  query('fuelType')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isIn to perform this step.
    .isIn(FUEL_TYPES)
    // Call .withMessage to perform this step.
    .withMessage('Invalid fuel type.'),
  // Call query to perform this step.
  query('seatsMin')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isInt to perform this step.
    .isInt({ min: CAR_SEATS_MIN, max: CAR_SEATS_MAX })
    // Call .withMessage to perform this step.
    .withMessage(`seatsMin must be an integer between ${CAR_SEATS_MIN} and ${CAR_SEATS_MAX}.`),
  // Call query to perform this step.
  query('seatsMax')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isInt to perform this step.
    .isInt({ min: CAR_SEATS_MIN, max: CAR_SEATS_MAX })
    // Call .withMessage to perform this step.
    .withMessage(`seatsMax must be an integer between ${CAR_SEATS_MIN} and ${CAR_SEATS_MAX}.`),
  // Call query to perform this step.
  query('priceMin')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isFloat to perform this step.
    .isFloat({ min: 0 })
    // Call .withMessage to perform this step.
    .withMessage('priceMin must be a non-negative number.'),
  // Call query to perform this step.
  query('priceMax')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isFloat to perform this step.
    .isFloat({ min: 0 })
    // Call .withMessage to perform this step.
    .withMessage('priceMax must be a non-negative number.'),
];

// Assign the CommonJS module exports.
module.exports = { carListQueryValidationRules };
