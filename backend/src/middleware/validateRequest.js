const { validationResult } = require('express-validator');
const apiResponse = require('../utils/apiResponse');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return apiResponse.error(
      res,
      'VALIDATION_ERROR',
      errors.array()[0]?.msg || 'Invalid request.',
      422
    );
  }

  return next();
}

function validateChatRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: errors.array()[0]?.msg || 'Invalid request.',
        correlationId: req.correlationId,
        details: errors.array(),
      },
    });
  }

  return next();
}

validateRequest.validateChatRequest = validateChatRequest;

module.exports = validateRequest;
