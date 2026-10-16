/**
 * Path-param validation for admin routes that take a car :id.
 */
const { param } = require('express-validator');

const adminCarIdParamValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid car id.'),
];

module.exports = { adminCarIdParamValidation };
