const { body } = require('express-validator');

// 32 random bytes rendered as hex. Rejecting anything else keeps malformed input away
// from the token lookup entirely.
const RAW_TOKEN_PATTERN = /^[0-9a-fA-F]{64}$/;

const authVerifyEmailValidationRules = [
  body('token')
    .isString()
    .withMessage('A confirmation token is required.')
    .bail()
    .trim()
    .matches(RAW_TOKEN_PATTERN)
    .withMessage('A confirmation token is required.'),
];

module.exports = {
  RAW_TOKEN_PATTERN,
  authVerifyEmailValidationRules,
};
