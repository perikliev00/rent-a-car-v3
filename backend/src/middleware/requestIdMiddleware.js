/**
 * Propagates request/correlation IDs via headers and AsyncLocalStorage for logging.
 * Mount early so downstream middleware and controllers inherit `req.requestId`.
 */
const crypto = require('crypto');
// Destructure object properties into local variables.
const { AsyncLocalStorage } = require('async_hooks');
// Require the '../utils/logger' module as logger.
const logger = require('../utils/logger');

// Create the request context storage constant.
const requestContextStorage = new AsyncLocalStorage();

/**
 * Prefer inbound X-Request-Id, then X-Correlation-Id, else generate a UUID.
 * @param {import('express').Request} req
 * @returns {string} Stable id for this request
 */
function resolveIncomingRequestId(req) {
  // Create the request id constant.
  const requestId = req.get('x-request-id');
  // Evaluate the condition and enter the branch when it is true.
  if (requestId && requestId.trim()) {
    // Return the resulting value to the caller.
    return requestId.trim();
  }

  // Create the correlation id constant.
  const correlationId = req.get('x-correlation-id');
  // Evaluate the condition and enter the branch when it is true.
  if (correlationId && correlationId.trim()) {
    // Return the resulting value to the caller.
    return correlationId.trim();
  }

  // Return the resulting value to the caller.
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
  // Create the request id constant.
  const requestId = resolveIncomingRequestId(req);

  // Update req.requestId with the right-hand side value.
  req.requestId = requestId;
  // Update req.correlationId with the right-hand side value.
  req.correlationId = requestId;
  // Update res.locals.requestId with the right-hand side value.
  res.locals.requestId = requestId;
  // Update res.locals.correlationId with the right-hand side value.
  res.locals.correlationId = requestId;
  // Call res.setHeader to perform this step.
  res.setHeader('X-Request-Id', requestId);
  // Call res.setHeader to perform this step.
  res.setHeader('X-Correlation-Id', requestId);

  // Child logger so handlers can `req.log.info` without threading ids manually.
  req.log = logger.child({ requestId });

  // Call requestContextStorage.run to perform this step.
  requestContextStorage.run({ requestId, log: req.log }, () => {
    // Call next to perform this step.
    next();
  });
}

/**
 * Read the ALS store for the current async context.
 * @returns {{ requestId: string, log: object }|null}
 */
function getRequestContext() {
  // Return the resulting value to the caller.
  return requestContextStorage.getStore() || null;
}

/**
 * Current request id from ALS, if inside a request.
 * @returns {string|null}
 */
function getRequestId() {
  // Return the resulting value to the caller.
  return getRequestContext()?.requestId || null;
}

/**
 * Child logger bound to the current request, or the root logger outside a request.
 * @returns {object} Pino-compatible logger
 */
function getRequestLogger() {
  // Return the resulting value to the caller.
  return getRequestContext()?.log || logger;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  requestIdMiddleware,
  // Provide the request context field value.
  requestContext: requestIdMiddleware,
  // Contribute this line to the enclosing declaration or statement.
  getRequestContext,
  // Contribute this line to the enclosing declaration or statement.
  getRequestId,
  // Contribute this line to the enclosing declaration or statement.
  getRequestLogger,
};
