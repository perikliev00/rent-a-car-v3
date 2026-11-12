/**
 * Path-param validation for public routes that take :carId.
 */
const { param } = require('express-validator');

// Create the car id param validation constant.
const carIdParamValidation = [
  // Call param to perform this step.
  param('carId')
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Invalid car id.'),
];

// Assign the CommonJS module exports.
module.exports = { carIdParamValidation };
