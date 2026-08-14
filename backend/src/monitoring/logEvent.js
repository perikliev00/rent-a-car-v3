const logger = require('../utils/logger');
const { getRequestId, getRequestLogger } = require('../middleware/requestIdMiddleware');
const metrics = require('./metrics');

function buildPayload(event, context = {}) {
  const requestId = context.requestId || getRequestId();
  return {
    event,
    ...(requestId ? { requestId } : {}),
    ...context,
  };
}

function logAtLevel(level, event, context = {}, message) {
  const payload = buildPayload(event, context);
  const log = getRequestLogger();
  log[level](payload, message || event);
  metrics.incrementBusinessEvent(event);
}

function info(event, context = {}, message) {
  logAtLevel('info', event, context, message);
}

function warn(event, context = {}, message) {
  logAtLevel('warn', event, context, message);
}

function error(event, context = {}, message) {
  logAtLevel('error', event, context, message);
}

module.exports = {
  info,
  warn,
  error,
  buildPayload,
};
