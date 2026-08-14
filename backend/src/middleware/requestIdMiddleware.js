const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const logger = require('../utils/logger');

const requestContextStorage = new AsyncLocalStorage();

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

function requestIdMiddleware(req, res, next) {
  const requestId = resolveIncomingRequestId(req);

  req.requestId = requestId;
  req.correlationId = requestId;
  res.locals.requestId = requestId;
  res.locals.correlationId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', requestId);

  req.log = logger.child({ requestId });

  requestContextStorage.run({ requestId, log: req.log }, () => {
    next();
  });
}

function getRequestContext() {
  return requestContextStorage.getStore() || null;
}

function getRequestId() {
  return getRequestContext()?.requestId || null;
}

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
