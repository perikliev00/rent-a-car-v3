/**
 * Shared helpers for calendar HTTP controllers.
 */

const { sessionAccess, canViewCalendar } = require('../calendar.permissions');
const apiResponse = require('../../../utils/apiResponse');

/**
 * Map service errors that already carry status/code into JSON responses.
 * Returns the response when handled, or null so callers can forward.
 * @param {Error} err
 * @param {import('express').Response} res
 */
function mapServiceError(err, res) {
  if (err?.status && err?.code) {
    const payload = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.conflicts ? { conflicts: err.conflicts } : {}),
      },
    };
    return res.status(err.status).json(payload);
  }
  return null;
}

/**
 * Ensure the session may view the calendar; writes 403 and returns null if not.
 * @returns {object|null} access object when allowed
 */
function requireCalendarView(req, res) {
  const access = sessionAccess(req);
  if (!canViewCalendar(access)) {
    apiResponse.error(res, 'FORBIDDEN', 'You do not have permission to access this resource.', 403);
    return null;
  }
  return access;
}

module.exports = {
  mapServiceError,
  requireCalendarView,
};
