/**
 * Path-param validation for admin contact message :id.
 */
const { param } = require('express-validator');

const adminContactIdParamValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid contact id.'),
];

module.exports = { adminContactIdParamValidation };
