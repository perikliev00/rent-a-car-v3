/**
 * Shared calendar helpers: realtime emit, HTTP errors, date-range parsing.
 */

const { publishCalendarUpdated } = require('../realtime/realtime.publisher');

/**
 * Notify connected clients that calendar data changed.
 * @param {{ action: string, entityType: string, entityId: string|number }} payload
 */
function emitCalendarUpdated({ action, entityType, entityId }) {
  publishCalendarUpdated({ action, entityType, entityId });
}

/**
 * Create an Error with HTTP metadata for Express error middleware.
 * @param {string} code
 * @param {string} message
 * @param {number} [status=400]
 * @param {object} [extra]
 */
function createHttpError(code, message, status = 400, extra = {}) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  Object.assign(err, extra);
  return err;
}

/**
 * Parse and validate a half-open calendar query range (from < to).
 * @param {string|Date} from
 * @param {string|Date} to
 * @returns {{ start: Date, end: Date }}
 */
function parseRange(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !(start < end)) {
    throw createHttpError('VALIDATION_ERROR', 'Invalid from/to range.', 422);
  }
  return { start, end };
}

module.exports = {
  emitCalendarUpdated,
  createHttpError,
  parseRange,
};
