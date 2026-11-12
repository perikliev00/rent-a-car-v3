/**
 * Structured business-event logging with request correlation and metrics counters.
 */

const logger = require('../utils/logger');
// Destructure object properties into local variables.
const { getRequestId, getRequestLogger } = require('../middleware/requestIdMiddleware');
// Require the './metrics' module as metrics.
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
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    event,
    // Call ... to perform this step.
    ...(requestId ? { requestId } : {}),
    // Spread context into the surrounding structure.
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
  // Create the payload constant.
  const payload = buildPayload(event, context);
  // Prefer the request-scoped logger when one is bound on the current request.
  const log = getRequestLogger();
  // Continue the surrounding logic with this statement.
  log[level](payload, message || event);
  // Call metrics.incrementBusinessEvent to perform this step.
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
  // Call logAtLevel to perform this step.
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
  // Call logAtLevel to perform this step.
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
  // Call logAtLevel to perform this step.
  logAtLevel('error', event, context, message);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  info,
  // Contribute this line to the enclosing declaration or statement.
  warn,
  // Contribute this line to the enclosing declaration or statement.
  error,
  // Contribute this line to the enclosing declaration or statement.
  buildPayload,
};
