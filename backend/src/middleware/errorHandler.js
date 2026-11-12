/**
 * Express 404 and centralized error middleware: normalize DB/domain errors,
 * log/metrics/Sentry, and shape JSON responses (API envelope vs legacy).
 */
const {
  AppError,
  ConflictError,
  isAppError,
} = require('../utils/appError');
const { isUniqueViolation, isCarDateBlockOverlapViolation, isReservationHoldOverlapViolation, isActiveSessionHoldUniqueViolation } = require('../db/transaction');
const logger = require('../utils/logger');
const { buildErrorPayload, getRequestIdFromReq } = require('../utils/httpResponse');
const { captureException } = require('../config/sentry');
const metrics = require('../monitoring/metrics');

/**
 * Whether the path should use the `{ success, error }` API envelope.
 * Chat routes keep a separate error contract.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function usesApiEnvelope(req) {
  const path = (req.originalUrl || '').split('?')[0];
  if (!path.startsWith('/api/') && path !== '/api') {
    return false;
  }
  // Chat keeps an alternate contract under both /api/chat and /api/v1/chat
  if (path === '/api/chat' || path.startsWith('/api/chat/')) {
    return false;
  }
  if (path === '/api/v1/chat' || path.startsWith('/api/v1/chat/')) {
    return false;
  }
  return true;
}

/**
 * Map thrown values and Postgres constraint violations to `AppError` / `ConflictError`.
 * Side effects: may increment conflict metrics for reservation-related violations.
 * @param {*} err - Thrown value from next(err) or async rejection
 * @returns {import('../utils/appError').AppError}
 */
function normalizeError(err) {
  if (isAppError(err)) {
    return err;
  }

  // One active unpaid hold per session — unique constraint.
  if (isActiveSessionHoldUniqueViolation(err)) {
    metrics.incrementReservationConflict('active_session_hold');
    return new ConflictError(
      'You already have an active reservation. Please complete or release it before starting another.'
    );
  }

  if (isUniqueViolation(err)) {
    return new ConflictError('A record with the same unique value already exists.', err.detail || null);
  }

  if (isCarDateBlockOverlapViolation(err)) {
    metrics.incrementReservationConflict('car_block_overlap');
    return new ConflictError('The requested booking overlaps with an existing reservation.');
  }

  if (isReservationHoldOverlapViolation(err)) {
    metrics.incrementReservationConflict('hold_overlap');
    return new ConflictError('Selected car is already reserved in this period.');
  }

  // Legacy Mongo-style duplicate key code still mapped for safety.
  if (err && err.code === 11000) {
    return new ConflictError('A record with the same unique value already exists.', err.keyValue || null);
  }

  if (err && err.code === 'OVERLAP') {
    metrics.incrementReservationConflict('overlap');
    return new ConflictError('The requested booking overlaps with an existing reservation.');
  }

  // Controllers sometimes throw plain objects with publicMessage/status.
  if (err && (err.publicMessage || err.status)) {
    const legacyError = new AppError(
      err.code || 'REQUEST_ERROR',
      err.status || 500,
      err.publicMessage || err.message || 'Request failed.',
      err.details || null
    );
    legacyError.stack = err.stack || legacyError.stack;
    legacyError.cause = err;
    if (err.controllerContext) {
      legacyError.details = {
        ...(legacyError.details || {}),
        controllerContext: err.controllerContext,
      };
    }
    return legacyError;
  }

  // Unknown errors become non-operational 500s (message hidden in production).
  const fallback = new AppError(
    'INTERNAL_ERROR',
    500,
    'An unexpected error occurred. Please try again later.',
    null,
    { isOperational: false }
  );

  fallback.cause = err;
  if (err && err.stack) {
    fallback.stack = err.stack;
  }

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
  metrics.incrementErrors();

  const severity = error.isOperational ? 'error' : 'fatal';
  const original = error.cause || error;
  const requestId = getRequestIdFromReq(req);

  logger[severity === 'fatal' ? 'error' : 'warn'](
    {
      requestId,
      correlationId: requestId,
      method: req.method,
      path: req.path,
      code: error.code,
      status: error.status,
      err: original,
      details: error.details || undefined,
      controllerContext:
        (error.cause || error).controllerContext || error.details?.controllerContext,
      operational: error.isOperational,
    },
    error.message
  );

  // Operational 4xx stay local; 5xx / programming errors go to Sentry.
  if (!error.isOperational || error.status >= 500) {
    captureException(original, {
      requestId,
      correlationId: requestId,
      tags: {
        errorCode: error.code,
        httpStatus: String(error.status),
      },
      extra: {
        method: req.method,
        path: req.path,
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
  const error = new AppError('NOT_FOUND', 404, 'The requested resource was not found.');
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
  const error = normalizeError(err);
  const isProd = process.env.NODE_ENV === 'production';
  // Never leak internal stacks/messages to clients in production.
  const publicMessage =
    error.isOperational || !isProd
      ? error.message
      : 'An unexpected error occurred. Please try again later.';

  logError(error, req);

  // If a response already started, hand off to Express default behavior.
  if (res.headersSent) {
    return next(err);
  }

  const requestId = getRequestIdFromReq(req);

  if (usesApiEnvelope(req)) {
    return res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: publicMessage,
        ...(requestId ? { requestId, correlationId: requestId } : {}),
      },
    });
  }

  const payload = buildErrorPayload(
    { code: error.code, message: publicMessage },
    req
  );

  return res.status(error.status).json(payload);
}

module.exports = {
  handleNotFound,
  errorHandler,
};
