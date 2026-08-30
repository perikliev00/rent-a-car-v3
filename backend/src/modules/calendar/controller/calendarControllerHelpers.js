const { sessionAccess, canViewCalendar } = require('../calendar.permissions');
const apiResponse = require('../../../utils/apiResponse');

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
