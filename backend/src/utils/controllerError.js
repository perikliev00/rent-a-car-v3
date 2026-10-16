/**
 * Controller helpers for attaching context to errors and emitting JSON error responses.
 */

const { AppError } = require('./appError');
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
  const { publicMessage, context } = options;

  // Attach a safe public message for the global error handler / client payload.
  if (publicMessage) {
    err.publicMessage = publicMessage;
  }

  // Attach controller context for structured logging (not always sent to clients).
  if (context) {
    err.controllerContext = context;
  }

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
  const {
    status = 500,
    code = 'INTERNAL_ERROR',
    message = 'An unexpected error occurred. Please try again later.',
  } = options;

  // Build a typed AppError so the payload shape matches middleware responses.
  const error = new AppError(code, status, message);
  return res.status(status).json(buildErrorPayload(error, req));
}

module.exports = {
  forwardControllerError,
  respondJsonError,
};
