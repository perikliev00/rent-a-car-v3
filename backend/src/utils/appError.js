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
    // Call super to perform this step.
    super(message);
    // Update this.name with the right-hand side value.
    this.name = this.constructor.name;
    // Update this.code with the right-hand side value.
    this.code = code || 'INTERNAL_ERROR';
    // Update this.status with the right-hand side value.
    this.status = status || 500;
    // Update this.details with the right-hand side value.
    this.details = details;
    // Operational errors are expected (validation, not found) and do not imply a process restart.
    this.isOperational = options.isOperational !== false;

    // Continue the surrounding logic with this statement.
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/** Invalid client input — HTTP 422. */
class ValidationError extends AppError {
  // Call constructor to perform this step.
  constructor(message = 'Invalid request data.', details = null) {
    // Call super to perform this step.
    super('VALIDATION_ERROR', 422, message, details);
  }
}

/** Missing or invalid authentication — HTTP 401. */
class AuthError extends AppError {
  // Call constructor to perform this step.
  constructor(message = 'Authentication required.', details = null) {
    // Call super to perform this step.
    super('AUTH_ERROR', 401, message, details);
  }
}

/** Authenticated but lacking permission — HTTP 403. */
class ForbiddenError extends AppError {
  // Call constructor to perform this step.
  constructor(message = 'You do not have permission to perform this action.', details = null) {
    // Call super to perform this step.
    super('FORBIDDEN', 403, message, details);
  }
}

/** Requested resource does not exist — HTTP 404. */
class NotFoundError extends AppError {
  // Call constructor to perform this step.
  constructor(message = 'Resource not found.', details = null) {
    // Call super to perform this step.
    super('NOT_FOUND', 404, message, details);
  }
}

/** Conflict with current state (duplicates, overlaps) — HTTP 409. */
class ConflictError extends AppError {
  // Call constructor to perform this step.
  constructor(message = 'The requested operation conflicts with the current state.', details = null) {
    // Call super to perform this step.
    super('CONFLICT', 409, message, details);
  }
}

/** Upstream service failure (Stripe, email, etc.) — HTTP 502. */
class ExternalServiceError extends AppError {
  // Call constructor to perform this step.
  constructor(message = 'External service is currently unavailable.', details = null, options = {}) {
    // Call super to perform this step.
    super('EXTERNAL_SERVICE_ERROR', 502, message, details, options);
  }
}

/** Rate limit exceeded — HTTP 429. */
class TooManyRequestsError extends AppError {
  // Call constructor to perform this step.
  constructor(message = 'Too many requests. Please wait a bit and try again.', details = null) {
    // Call super to perform this step.
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
  // Return the resulting value to the caller.
  return error instanceof AppError;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  AppError,
  // Contribute this line to the enclosing declaration or statement.
  ValidationError,
  // Contribute this line to the enclosing declaration or statement.
  AuthError,
  // Contribute this line to the enclosing declaration or statement.
  ForbiddenError,
  // Contribute this line to the enclosing declaration or statement.
  NotFoundError,
  // Contribute this line to the enclosing declaration or statement.
  ConflictError,
  // Contribute this line to the enclosing declaration or statement.
  ExternalServiceError,
  // Contribute this line to the enclosing declaration or statement.
  TooManyRequestsError,
  // Contribute this line to the enclosing declaration or statement.
  isAppError,
};
