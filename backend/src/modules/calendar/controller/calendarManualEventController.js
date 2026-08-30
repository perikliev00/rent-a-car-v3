const calendarService = require('../calendar.service');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');
const { mapServiceError, requireCalendarView } = require('./calendarControllerHelpers');

const createManualEvent = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const event = await calendarService.createManualEvent(access, req.body, req);
    return apiResponse.success(res, { event }, 201);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.createManualEvent',
      publicMessage: 'Error creating calendar block.',
    });
  }
});

const updateManualEvent = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const event = await calendarService.updateManualEvent(access, req.params.id, req.body, req);
    return apiResponse.success(res, { event });
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.updateManualEvent',
      publicMessage: 'Error updating calendar block.',
    });
  }
});

const deleteManualEvent = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const data = await calendarService.deleteManualEvent(access, req.params.id, req);
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.deleteManualEvent',
      publicMessage: 'Error deleting calendar block.',
    });
  }
});

module.exports = {
  createManualEvent,
  updateManualEvent,
  deleteManualEvent,
};
