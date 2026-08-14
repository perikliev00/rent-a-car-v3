const { param } = require('express-validator');

const adminCarIdParamValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid car id.'),
];

module.exports = { adminCarIdParamValidation };
