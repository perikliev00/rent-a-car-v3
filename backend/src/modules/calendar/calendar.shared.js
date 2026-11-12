/**
 * Shared calendar helpers: realtime emit, HTTP errors, date-range parsing.
 */

const { publishCalendarUpdated } = require('../realtime/realtime.publisher');

/**
 * Notify connected clients that calendar data changed.
 * @param {{ action: string, entityType: string, entityId: string|number }} payload
 */
function emitCalendarUpdated({ action, entityType, entityId }) {
  // Call publishCalendarUpdated to perform this step.
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
  // Create the err constant.
  const err = new Error(message);
  // Update err.code with the right-hand side value.
  err.code = code;
  // Update err.status with the right-hand side value.
  err.status = status;
  // Call Object.assign to perform this step.
  Object.assign(err, extra);
  // Return the resulting value to the caller.
  return err;
}

/**
 * Parse and validate a half-open calendar query range (from < to).
 * @param {string|Date} from
 * @param {string|Date} to
 * @returns {{ start: Date, end: Date }}
 */
function parseRange(from, to) {
  // Create the start constant.
  const start = new Date(from);
  // Create the end constant.
  const end = new Date(to);
  // Evaluate the condition and enter the branch when it is true.
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !(start < end)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Invalid from/to range.', 422);
  }
  // Return the resulting value to the caller.
  return { start, end };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  emitCalendarUpdated,
  // Contribute this line to the enclosing declaration or statement.
  createHttpError,
  // Contribute this line to the enclosing declaration or statement.
  parseRange,
};
