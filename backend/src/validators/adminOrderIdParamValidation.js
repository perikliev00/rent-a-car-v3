const { param } = require('express-validator');

const adminOrderIdParamValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid order id.'),
];

module.exports = { adminOrderIdParamValidation };
