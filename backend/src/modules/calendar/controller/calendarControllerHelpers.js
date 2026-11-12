/**
 * Shared helpers for calendar HTTP controllers.
 */

const { sessionAccess, canViewCalendar } = require('../calendar.permissions');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');

/**
 * Map service errors that already carry status/code into JSON responses.
 * Returns the response when handled, or null so callers can forward.
 * @param {Error} err
 * @param {import('express').Response} res
 */
function mapServiceError(err, res) {
  // Evaluate the condition and enter the branch when it is true.
  if (err?.status && err?.code) {
    // Create the payload constant.
    const payload = {
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: err.code,
        // Provide the message field value.
        message: err.message,
        // Call ... to perform this step.
        ...(err.conflicts ? { conflicts: err.conflicts } : {}),
      },
    };
    // Return the resulting value to the caller.
    return res.status(err.status).json(payload);
  }
  // Return the resulting value to the caller.
  return null;
}

/**
 * Ensure the session may view the calendar; writes 403 and returns null if not.
 * @returns {object|null} access object when allowed
 */
function requireCalendarView(req, res) {
  // Create the access constant.
  const access = sessionAccess(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!canViewCalendar(access)) {
    // Call apiResponse.error to perform this step.
    apiResponse.error(res, 'FORBIDDEN', 'You do not have permission to access this resource.', 403);
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
  return access;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapServiceError,
  // Contribute this line to the enclosing declaration or statement.
  requireCalendarView,
};
