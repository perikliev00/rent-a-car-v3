/**
 * express-validator result helpers for the standard API envelope and chat contract.
 */
const { validationResult } = require('express-validator');
// Require the '../utils/apiResponse' module as apiResponse.
const apiResponse = require('../utils/apiResponse');
// Destructure object properties into local variables.
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
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Multer may already have stored a file. Do not leave it behind a 422.
    return discardTempUploads(req)
      // Call .catch to perform this step.
      .catch(() => {})
      // Call .then to perform this step.
      .then(() =>
        // Call apiResponse.error to perform this step.
        apiResponse.error(
          // Contribute this line to the enclosing declaration or statement.
          res,
          // Supply the literal value used by the enclosing expression.
          'VALIDATION_ERROR',
          // Call errors.array to perform this step.
          errors.array()[0]?.msg || 'Invalid request.',
          // Supply the literal value used by the enclosing expression.
          422
        )
      );
  }

  // Return the resulting value to the caller.
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
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return res.status(400).json({
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'VALIDATION_ERROR',
        // Provide the message field value.
        message: errors.array()[0]?.msg || 'Invalid request.',
        // Provide the correlation id field value.
        correlationId: req.correlationId,
        // Provide the details field value.
        details: errors.array(),
      },
    });
  }

  // Return the resulting value to the caller.
  return next();
}

// Update validateRequest.validateChatRequest with the right-hand side value.
validateRequest.validateChatRequest = validateChatRequest;

// Assign the CommonJS module exports.
module.exports = validateRequest;
