/**
 * Express 404 and centralized error middleware: normalize DB/domain errors,
 * log/metrics/Sentry, and shape JSON responses (API envelope vs legacy).
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  AppError,
  // Contribute this line to the enclosing declaration or statement.
  ConflictError,
  // Contribute this line to the enclosing declaration or statement.
  isAppError,
// Continue the surrounding logic with this statement.
} = require('../utils/appError');
// Destructure object properties into local variables.
const { isUniqueViolation, isCarDateBlockOverlapViolation, isReservationHoldOverlapViolation, isActiveSessionHoldUniqueViolation } = require('../db/transaction');
// Require the '../utils/logger' module as logger.
const logger = require('../utils/logger');
// Destructure object properties into local variables.
const { buildErrorPayload, getRequestIdFromReq } = require('../utils/httpResponse');
// Destructure object properties into local variables.
const { captureException } = require('../config/sentry');
// Require the '../monitoring/metrics' module as metrics.
const metrics = require('../monitoring/metrics');

/**
 * Whether the path should use the `{ success, error }` API envelope.
 * Chat routes keep a separate error contract.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function usesApiEnvelope(req) {
  // Create the path constant.
  const path = (req.originalUrl || '').split('?')[0];
  // Evaluate the condition and enter the branch when it is true.
  if (!path.startsWith('/api/') && path !== '/api') {
    // Return the resulting value to the caller.
    return false;
  }
  // Chat keeps an alternate contract under both /api/chat and /api/v1/chat
  if (path === '/api/chat' || path.startsWith('/api/chat/')) {
    // Return the resulting value to the caller.
    return false;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (path === '/api/v1/chat' || path.startsWith('/api/v1/chat/')) {
    // Return the resulting value to the caller.
    return false;
  }
  // Return the resulting value to the caller.
  return true;
}

/**
 * Map thrown values and Postgres constraint violations to `AppError` / `ConflictError`.
 * Side effects: may increment conflict metrics for reservation-related violations.
 * @param {*} err - Thrown value from next(err) or async rejection
 * @returns {import('../utils/appError').AppError}
 */
function normalizeError(err) {
  // Evaluate the condition and enter the branch when it is true.
  if (isAppError(err)) {
    // Return the resulting value to the caller.
    return err;
  }

  // One active unpaid hold per session — unique constraint.
  if (isActiveSessionHoldUniqueViolation(err)) {
    // Call metrics.incrementReservationConflict to perform this step.
    metrics.incrementReservationConflict('active_session_hold');
    // Return the resulting value to the caller.
    return new ConflictError(
      // Supply the literal value used by the enclosing expression.
      'You already have an active reservation. Please complete or release it before starting another.'
    );
  }

  // Evaluate the condition and enter the branch when it is true.
  if (isUniqueViolation(err)) {
    // Return the resulting value to the caller.
    return new ConflictError('A record with the same unique value already exists.', err.detail || null);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (isCarDateBlockOverlapViolation(err)) {
    // Call metrics.incrementReservationConflict to perform this step.
    metrics.incrementReservationConflict('car_block_overlap');
    // Return the resulting value to the caller.
    return new ConflictError('The requested booking overlaps with an existing reservation.');
  }

  // Evaluate the condition and enter the branch when it is true.
  if (isReservationHoldOverlapViolation(err)) {
    // Call metrics.incrementReservationConflict to perform this step.
    metrics.incrementReservationConflict('hold_overlap');
    // Return the resulting value to the caller.
    return new ConflictError('Selected car is already reserved in this period.');
  }

  // Legacy Mongo-style duplicate key code still mapped for safety.
  if (err && err.code === 11000) {
    // Return the resulting value to the caller.
    return new ConflictError('A record with the same unique value already exists.', err.keyValue || null);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (err && err.code === 'OVERLAP') {
    // Call metrics.incrementReservationConflict to perform this step.
    metrics.incrementReservationConflict('overlap');
    // Return the resulting value to the caller.
    return new ConflictError('The requested booking overlaps with an existing reservation.');
  }

  // Controllers sometimes throw plain objects with publicMessage/status.
  if (err && (err.publicMessage || err.status)) {
    // Create the legacy error constant.
    const legacyError = new AppError(
      // Contribute this line to the enclosing declaration or statement.
      err.code || 'REQUEST_ERROR',
      // Contribute this line to the enclosing declaration or statement.
      err.status || 500,
      // Contribute this line to the enclosing declaration or statement.
      err.publicMessage || err.message || 'Request failed.',
      // Contribute this line to the enclosing declaration or statement.
      err.details || null
    );
    // Update legacyError.stack with the right-hand side value.
    legacyError.stack = err.stack || legacyError.stack;
    // Update legacyError.cause with the right-hand side value.
    legacyError.cause = err;
    // Evaluate the condition and enter the branch when it is true.
    if (err.controllerContext) {
      // Update legacyError.details with the right-hand side value.
      legacyError.details = {
        // Call ... to perform this step.
        ...(legacyError.details || {}),
        // Provide the controller context field value.
        controllerContext: err.controllerContext,
      };
    }
    // Return the resulting value to the caller.
    return legacyError;
  }

  // Unknown errors become non-operational 500s (message hidden in production).
  const fallback = new AppError(
    // Supply the literal value used by the enclosing expression.
    'INTERNAL_ERROR',
    // Supply the literal value used by the enclosing expression.
    500,
    // Supply the literal value used by the enclosing expression.
    'An unexpected error occurred. Please try again later.',
    // Supply the literal value used by the enclosing expression.
    null,
    // Contribute this line to the enclosing declaration or statement.
    { isOperational: false }
  );

  // Update fallback.cause with the right-hand side value.
  fallback.cause = err;
  // Evaluate the condition and enter the branch when it is true.
  if (err && err.stack) {
    // Update fallback.stack with the right-hand side value.
    fallback.stack = err.stack;
  }

  // Return the resulting value to the caller.
  return fallback;
}

/**
 * Record metrics, structured logs, and Sentry for server-side failures.
 * Side effects: increments error metrics, writes logs, may report to Sentry.
 * @param {import('../utils/appError').AppError} error - Normalized application error
 * @param {import('express').Request} req
 * @returns {void}
 */
function logError(error, req) {
  // Call metrics.incrementErrors to perform this step.
  metrics.incrementErrors();

  // Create the severity constant.
  const severity = error.isOperational ? 'error' : 'fatal';
  // Create the original constant.
  const original = error.cause || error;
  // Create the request id constant.
  const requestId = getRequestIdFromReq(req);

  // Update logger[severity with the right-hand side value.
  logger[severity === 'fatal' ? 'error' : 'warn'](
    {
      // Contribute this line to the enclosing declaration or statement.
      requestId,
      // Provide the correlation id field value.
      correlationId: requestId,
      // Provide the method field value.
      method: req.method,
      // Provide the path field value.
      path: req.path,
      // Provide the code field value.
      code: error.code,
      // Provide the status field value.
      status: error.status,
      // Provide the err field value.
      err: original,
      // Provide the details field value.
      details: error.details || undefined,
      // Provide the controller context field value.
      controllerContext:
        // Continue the surrounding logic with this statement.
        (error.cause || error).controllerContext || error.details?.controllerContext,
      // Provide the operational field value.
      operational: error.isOperational,
    },
    // Contribute this line to the enclosing declaration or statement.
    error.message
  );

  // Operational 4xx stay local; 5xx / programming errors go to Sentry.
  if (!error.isOperational || error.status >= 500) {
    // Call captureException to perform this step.
    captureException(original, {
      // Contribute this line to the enclosing declaration or statement.
      requestId,
      // Provide the correlation id field value.
      correlationId: requestId,
      // Provide the tags field value.
      tags: {
        // Provide the error code field value.
        errorCode: error.code,
        // Provide the http status field value.
        httpStatus: String(error.status),
      },
      // Provide the extra field value.
      extra: {
        // Provide the method field value.
        method: req.method,
        // Provide the path field value.
        path: req.path,
        // Provide the details field value.
        details: error.details || undefined,
      },
    });
  }
}

/**
 * Fall-through 404 handler — forwards a NOT_FOUND AppError to `errorHandler`.
 * Side effects: calls `next(error)` with a 404 AppError.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function handleNotFound(req, res, next) {
  // Create the error constant.
  const error = new AppError('NOT_FOUND', 404, 'The requested resource was not found.');
  // Call next to perform this step.
  next(error);
}

/**
 * Final Express error middleware. Hides non-operational messages in production.
 * Side effects: logs, may write JSON error body, or delegates if headers already sent.
 * @param {*} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void|import('express').Response}
 */
function errorHandler(err, req, res, next) {
  // Create the error constant.
  const error = normalizeError(err);
  // Create the is prod constant.
  const isProd = process.env.NODE_ENV === 'production';
  // Never leak internal stacks/messages to clients in production.
  const publicMessage =
    // Contribute this line to the enclosing declaration or statement.
    error.isOperational || !isProd
      // Contribute this line to the enclosing declaration or statement.
      ? error.message
      // Contribute this line to the enclosing declaration or statement.
      : 'An unexpected error occurred. Please try again later.';

  // Call logError to perform this step.
  logError(error, req);

  // If a response already started, hand off to Express default behavior.
  if (res.headersSent) {
    // Return the resulting value to the caller.
    return next(err);
  }

  // Create the request id constant.
  const requestId = getRequestIdFromReq(req);

  // Evaluate the condition and enter the branch when it is true.
  if (usesApiEnvelope(req)) {
    // Return the resulting value to the caller.
    return res.status(error.status).json({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: error.code,
        // Provide the message field value.
        message: publicMessage,
        // Call ... to perform this step.
        ...(requestId ? { requestId, correlationId: requestId } : {}),
      },
    });
  }

  // Create the payload constant.
  const payload = buildErrorPayload(
    // Contribute this line to the enclosing declaration or statement.
    { code: error.code, message: publicMessage },
    // Reference the identifier used by the enclosing expression.
    req
  );

  // Return the resulting value to the caller.
  return res.status(error.status).json(payload);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  handleNotFound,
  // Contribute this line to the enclosing declaration or statement.
  errorHandler,
};
