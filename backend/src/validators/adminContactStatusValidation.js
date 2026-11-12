/**
 * Body validation for updating an admin contact message status.
 */
const { body } = require('express-validator');

// Create the admin contact status validation constant.
const adminContactStatusValidation = [
  // Call body to perform this step.
  body('status')
    // Call .isIn to perform this step.
    .isIn(['new', 'ready', 'done'])
    // Call .withMessage to perform this step.
    .withMessage('Status must be new, ready, or done.'),
];

// Assign the CommonJS module exports.
module.exports = { adminContactStatusValidation };
