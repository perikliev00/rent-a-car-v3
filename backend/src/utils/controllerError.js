/**
 * Controller helpers for attaching context to errors and emitting JSON error responses.
 */

const { AppError } = require('./appError');
// Destructure object properties into local variables.
const { buildErrorPayload } = require('./httpResponse');

/**
 * Enrich an error with optional public message / controller context, then pass it to `next`.
 *
 * @param {Error & { publicMessage?: string, controllerContext?: unknown }} err
 * @param {import('express').Request} req
 * @param {import('express').NextFunction} next
 * @param {{ publicMessage?: string, context?: unknown }} [options={}]
 * @returns {unknown} Result of `next(err)`
 * @throws {never}
 */
function forwardControllerError(err, req, next, options = {}) {
  // Destructure object properties into local variables.
  const { publicMessage, context } = options;

  // Attach a safe public message for the global error handler / client payload.
  if (publicMessage) {
    // Update err.publicMessage with the right-hand side value.
    err.publicMessage = publicMessage;
  }

  // Attach controller context for structured logging (not always sent to clients).
  if (context) {
    // Update err.controllerContext with the right-hand side value.
    err.controllerContext = context;
  }

  // Return the resulting value to the caller.
  return next(err);
}

/**
 * Immediately respond with a JSON AppError payload (bypassing the normal error middleware path).
 *
 * @param {import('express').Response} res
 * @param {import('express').Request} req
 * @param {{ status?: number, code?: string, message?: string }} [options={}]
 * @returns {import('express').Response}
 * @throws {never}
 */
function respondJsonError(res, req, options = {}) {
  // Destructure object properties into local variables.
  const {
    // Update status with the right-hand side value.
    status = 500,
    // Update code with the right-hand side value.
    code = 'INTERNAL_ERROR',
    // Update message with the right-hand side value.
    message = 'An unexpected error occurred. Please try again later.',
  // Continue the surrounding logic with this statement.
  } = options;

  // Build a typed AppError so the payload shape matches middleware responses.
  const error = new AppError(code, status, message);
  // Return the resulting value to the caller.
  return res.status(status).json(buildErrorPayload(error, req));
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  forwardControllerError,
  // Contribute this line to the enclosing declaration or statement.
  respondJsonError,
};
