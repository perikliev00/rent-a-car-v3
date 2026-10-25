/**
 * express-validator result helpers for the standard API envelope and chat contract.
 */
const { validationResult } = require('express-validator');
const apiResponse = require('../utils/apiResponse');
const { discardTempUploads } = require('./fileUpload/cleanupTempUploads');

/**
 * Reject with 422 + API envelope when express-validator reported errors.
 * Side effects: may write a 422 JSON error response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void|import('express').Response}
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Multer may already have stored a file. Do not leave it behind a 422.
    return discardTempUploads(req)
      .catch(() => {})
      .then(() =>
        apiResponse.error(
          res,
          'VALIDATION_ERROR',
          errors.array()[0]?.msg || 'Invalid request.',
          422
        )
      );
  }

  return next();
}

/**
 * Chat-specific validation errors (400 + alternate error shape with correlationId).
 * Side effects: may write a 400 JSON error response (non-envelope chat contract).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void|import('express').Response}
 */
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
