/**
 * Propagates request/correlation IDs via headers and AsyncLocalStorage for logging.
 * Mount early so downstream middleware and controllers inherit `req.requestId`.
 */
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const logger = require('../utils/logger');

const requestContextStorage = new AsyncLocalStorage();

/**
 * Prefer inbound X-Request-Id, then X-Correlation-Id, else generate a UUID.
 * @param {import('express').Request} req
 * @returns {string} Stable id for this request
 */
function resolveIncomingRequestId(req) {
  const requestId = req.get('x-request-id');
  if (requestId && requestId.trim()) {
    return requestId.trim();
  }

  const correlationId = req.get('x-correlation-id');
  if (correlationId && correlationId.trim()) {
    return correlationId.trim();
  }

  return crypto.randomUUID();
}

/**
 * Attach requestId/correlationId to req/res and run the rest of the chain in ALS.
 * Side effects: mutates req/res, sets response headers, enters AsyncLocalStorage.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function requestIdMiddleware(req, res, next) {
  const requestId = resolveIncomingRequestId(req);

  req.requestId = requestId;
  req.correlationId = requestId;
  res.locals.requestId = requestId;
  res.locals.correlationId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', requestId);

  // Child logger so handlers can `req.log.info` without threading ids manually.
  req.log = logger.child({ requestId });

  requestContextStorage.run({ requestId, log: req.log }, () => {
    next();
  });
}

/**
 * Read the ALS store for the current async context.
 * @returns {{ requestId: string, log: object }|null}
 */
function getRequestContext() {
  return requestContextStorage.getStore() || null;
}

/**
 * Current request id from ALS, if inside a request.
 * @returns {string|null}
 */
function getRequestId() {
  return getRequestContext()?.requestId || null;
}

/**
 * Child logger bound to the current request, or the root logger outside a request.
 * @returns {object} Pino-compatible logger
 */
function getRequestLogger() {
  return getRequestContext()?.log || logger;
}

module.exports = {
  requestIdMiddleware,
  requestContext: requestIdMiddleware,
  getRequestContext,
  getRequestId,
  getRequestLogger,
};
