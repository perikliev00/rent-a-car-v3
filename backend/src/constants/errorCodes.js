/**
 * Canonical API error codes used in `{ success: false, error: { code } }` responses.
 * Keep in sync with AppError subclasses in utils/appError.js and middleware codes.
 */
const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  CSRF_INVALID: 'CSRF_INVALID',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  REQUEST_ERROR: 'REQUEST_ERROR',
});

module.exports = {
  ERROR_CODES,
};
