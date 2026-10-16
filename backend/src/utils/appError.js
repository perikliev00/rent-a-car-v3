/**
 * Typed application errors with HTTP status codes and machine-readable error codes.
 * Controllers and middleware throw these so the global error handler can map them consistently.
 */

/** Base application error extending the built-in Error. */
class AppError extends Error {
  /**
   * @param {string} code - Machine-readable classification (e.g. "VALIDATION_ERROR", "NOT_FOUND").
   * @param {number} status - HTTP status code (e.g. 422, 404, 500).
   * @param {string} message - Human-readable error message.
   * @param {unknown} [details=null] - Optional structured details for clients or logs.
   * @param {{ isOperational?: boolean }} [options={}] - Operational errors are expected (validation, not found).
   */
  constructor(code, status, message, details = null, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code || 'INTERNAL_ERROR';
    this.status = status || 500;
    this.details = details;
    // Operational errors are expected (validation, not found) and do not imply a process restart.
    this.isOperational = options.isOperational !== false;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

/** Invalid client input — HTTP 422. */
class ValidationError extends AppError {
  constructor(message = 'Invalid request data.', details = null) {
    super('VALIDATION_ERROR', 422, message, details);
  }
}

/** Missing or invalid authentication — HTTP 401. */
class AuthError extends AppError {
  constructor(message = 'Authentication required.', details = null) {
    super('AUTH_ERROR', 401, message, details);
  }
}

/** Authenticated but lacking permission — HTTP 403. */
class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.', details = null) {
    super('FORBIDDEN', 403, message, details);
  }
}

/** Requested resource does not exist — HTTP 404. */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found.', details = null) {
    super('NOT_FOUND', 404, message, details);
  }
}

/** Conflict with current state (duplicates, overlaps) — HTTP 409. */
class ConflictError extends AppError {
  constructor(message = 'The requested operation conflicts with the current state.', details = null) {
    super('CONFLICT', 409, message, details);
  }
}

/** Upstream service failure (Stripe, email, etc.) — HTTP 502. */
class ExternalServiceError extends AppError {
  constructor(message = 'External service is currently unavailable.', details = null, options = {}) {
    super('EXTERNAL_SERVICE_ERROR', 502, message, details, options);
  }
}

/** Rate limit exceeded — HTTP 429. */
class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests. Please wait a bit and try again.', details = null) {
    super('RATE_LIMITED', 429, message, details);
  }
}

/**
 * Type guard for AppError (or any subclass).
 *
 * @param {unknown} error
 * @returns {boolean} True if the value is an AppError (or subclass) instance.
 * @throws {never}
 */
function isAppError(error) {
  return error instanceof AppError;
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ExternalServiceError,
  TooManyRequestsError,
  isAppError,
};
