/**
 * Structured business-event logging with request correlation and metrics counters.
 */

const logger = require('../utils/logger');
const { getRequestId, getRequestLogger } = require('../middleware/requestIdMiddleware');
const metrics = require('./metrics');

/**
 * Build a structured log payload with event name and optional requestId.
 *
 * @param {string} event - Stable business event name
 * @param {Record<string, unknown>} [context={}] - Extra fields (may include requestId)
 * @returns {object} Payload object suitable for pino
 * @throws {never}
 */
function buildPayload(event, context = {}) {
  // Prefer explicit context.requestId, else fall back to ALS / middleware.
  const requestId = context.requestId || getRequestId();
  return {
    event,
    ...(requestId ? { requestId } : {}),
    ...context,
  };
}

/**
 * Log at a specific level and increment the business-event metric.
 *
 * @param {'info'|'warn'|'error'} level - Pino level method name
 * @param {string} event - Stable business event name
 * @param {Record<string, unknown>} [context={}]
 * @param {string} [message] - Human message; defaults to `event`
 * @returns {void}
 * @throws {never}
 */
function logAtLevel(level, event, context = {}, message) {
  const payload = buildPayload(event, context);
  // Prefer the request-scoped logger when one is bound on the current request.
  const log = getRequestLogger();
  log[level](payload, message || event);
  metrics.incrementBusinessEvent(event);
}

/**
 * Info-level business event.
 *
 * @param {string} event
 * @param {Record<string, unknown>} [context={}]
 * @param {string} [message]
 * @returns {void}
 * @throws {never}
 */
function info(event, context = {}, message) {
  logAtLevel('info', event, context, message);
}

/**
 * Warn-level business event.
 *
 * @param {string} event
 * @param {Record<string, unknown>} [context={}]
 * @param {string} [message]
 * @returns {void}
 * @throws {never}
 */
function warn(event, context = {}, message) {
  logAtLevel('warn', event, context, message);
}

/**
 * Error-level business event (does not capture to Sentry by itself).
 *
 * @param {string} event
 * @param {Record<string, unknown>} [context={}]
 * @param {string} [message]
 * @returns {void}
 * @throws {never}
 */
function error(event, context = {}, message) {
  logAtLevel('error', event, context, message);
}

module.exports = {
  info,
  warn,
  error,
  buildPayload,
};
