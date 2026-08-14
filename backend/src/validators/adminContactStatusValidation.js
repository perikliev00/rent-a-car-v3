const { body } = require('express-validator');

const adminContactStatusValidation = [
  body('status')
    .isIn(['new', 'ready', 'done'])
    .withMessage('Status must be new, ready, or done.'),
];

module.exports = { adminContactStatusValidation };
