const calendarService = require('../calendar.service');
const { sessionAccess } = require('../calendar.permissions');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');
const { mapServiceError, requireCalendarView } = require('./calendarControllerHelpers');

const moveEvent = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const events = await calendarService.moveOrResizeEvent(
      access,
      req.params.id,
      req.body,
      req,
      'move'
    );
    return apiResponse.success(res, { events });
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.moveEvent',
      publicMessage: 'Error moving calendar event.',
    });
  }
});

const resizeEvent = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const events = await calendarService.moveOrResizeEvent(
      access,
      req.params.id,
      req.body,
      req,
      'resize'
    );
    return apiResponse.success(res, { events });
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.resizeEvent',
      publicMessage: 'Error resizing calendar event.',
    });
  }
});

const cancelReservation = asyncHandler(async (req, res, next) => {
  try {
    const access = sessionAccess(req);
    const data = await calendarService.cancelReservationFromCalendar(
      access,
      req.params.id,
      req
    );
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.cancelReservation',
      publicMessage: 'Error cancelling reservation.',
    });
  }
});

module.exports = {
  moveEvent,
  resizeEvent,
  cancelReservation,
};
