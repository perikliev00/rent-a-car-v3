/**
 * Canonical API error codes used in `{ success: false, error: { code } }` responses.
 * Keep in sync with AppError subclasses in utils/appError.js and middleware codes.
 */
const ERROR_CODES = Object.freeze({
  // Provide the validation error field value.
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  // Provide the auth error field value.
  AUTH_ERROR: 'AUTH_ERROR',
  // Provide the unauthorized field value.
  UNAUTHORIZED: 'UNAUTHORIZED',
  // Provide the forbidden field value.
  FORBIDDEN: 'FORBIDDEN',
  // Provide the not found field value.
  NOT_FOUND: 'NOT_FOUND',
  // Provide the conflict field value.
  CONFLICT: 'CONFLICT',
  // Provide the rate limited field value.
  RATE_LIMITED: 'RATE_LIMITED',
  // Provide the csrf invalid field value.
  CSRF_INVALID: 'CSRF_INVALID',
  // Provide the external service error field value.
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  // Provide the internal error field value.
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // Provide the request error field value.
  REQUEST_ERROR: 'REQUEST_ERROR',
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ERROR_CODES,
};
