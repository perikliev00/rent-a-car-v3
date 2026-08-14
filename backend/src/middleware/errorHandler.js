const {
  AppError,
  ConflictError,
  isAppError,
} = require('../utils/appError');
const { isUniqueViolation, isCarDateBlockOverlapViolation, isReservationHoldOverlapViolation } = require('../db/transaction');
const logger = require('../utils/logger');
const { buildErrorPayload, getRequestIdFromReq } = require('../utils/httpResponse');
const { captureException } = require('../config/sentry');
const metrics = require('../monitoring/metrics');

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

function normalizeError(err) {
  if (isAppError(err)) {
    return err;
  }

  if (isUniqueViolation(err)) {
    return new ConflictError('A record with the same unique value already exists.', err.detail || null);
  }

  if (isCarDateBlockOverlapViolation(err)) {
    return new ConflictError('The requested booking overlaps with an existing reservation.');
  }

  if (isReservationHoldOverlapViolation(err)) {
    return new ConflictError('Selected car is already reserved in this period.');
  }

  if (err && err.code === 11000) {
    return new ConflictError('A record with the same unique value already exists.', err.keyValue || null);
  }

  if (err && err.code === 'OVERLAP') {
    return new ConflictError('The requested booking overlaps with an existing reservation.');
  }

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

function handleNotFound(req, res, next) {
  const error = new AppError('NOT_FOUND', 404, 'The requested resource was not found.');
  next(error);
}

function errorHandler(err, req, res, next) {
  const error = normalizeError(err);
  const isProd = process.env.NODE_ENV === 'production';
  const publicMessage =
    error.isOperational || !isProd
      ? error.message
      : 'An unexpected error occurred. Please try again later.';

  logError(error, req);

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
