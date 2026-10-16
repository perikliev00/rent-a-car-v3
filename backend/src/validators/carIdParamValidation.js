/**
 * Path-param validation for public routes that take :carId.
 */
const { param } = require('express-validator');

const carIdParamValidation = [
  param('carId')
    .isInt({ min: 1 })
    .withMessage('Invalid car id.'),
];

module.exports = { carIdParamValidation };
