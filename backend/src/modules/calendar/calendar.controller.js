const calendarService = require('./calendar.service');
const { sessionAccess, canViewCalendar } = require('./calendar.permissions');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');

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

exports.getEvents = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const data = await calendarService.getEvents({
      access,
      from: req.query.from,
      to: req.query.to,
      density: req.query.density || 'timeline',
      filters: {
        categoryId: req.query.categoryId,
        transmission: req.query.transmission,
        fuelType: req.query.fuelType,
        carStatus: req.query.carStatus,
        location: req.query.location,
        reservationStatus: req.query.reservationStatus,
        eventType: req.query.eventType,
        staffUserId: req.query.staffUserId,
      },
    });
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.getEvents',
      publicMessage: 'Error loading calendar events.',
    });
  }
});

exports.getDay = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const data = await calendarService.getDay(access, req.params.date);
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.getDay',
      publicMessage: 'Error loading day operations.',
    });
  }
});

exports.getCar = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const data = await calendarService.getCarTimeline(
      access,
      req.params.carId,
      req.query.from,
      req.query.to
    );
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.getCar',
      publicMessage: 'Error loading car calendar.',
    });
  }
});

exports.getAvailability = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const data = await calendarService.getAvailability(
      access,
      req.query.carId,
      req.query.from,
      req.query.to
    );
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.getAvailability',
      publicMessage: 'Error checking availability.',
    });
  }
});

exports.getConflicts = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const data = await calendarService.getConflicts(access, req.query.from, req.query.to);
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.getConflicts',
      publicMessage: 'Error loading conflicts.',
    });
  }
});

exports.getEventDetails = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const data = await calendarService.getEventDetails(access, req.params.id);
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.getEventDetails',
      publicMessage: 'Error loading event details.',
    });
  }
});

exports.createManualEvent = asyncHandler(async (req, res, next) => {
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

exports.updateManualEvent = asyncHandler(async (req, res, next) => {
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

exports.deleteManualEvent = asyncHandler(async (req, res, next) => {
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

exports.createTask = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const event = await calendarService.createTask(access, req.body, req);
    return apiResponse.success(res, { event }, 201);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.createTask',
      publicMessage: 'Error creating calendar task.',
    });
  }
});

exports.listTasks = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const data = await calendarService.listTasks(access, req.query);
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.listTasks',
      publicMessage: 'Error listing calendar tasks.',
    });
  }
});

exports.listAssignableStaff = asyncHandler(async (req, res, next) => {
  try {
    const access = sessionAccess(req);
    const data = await calendarService.listAssignableStaff(access);
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.listAssignableStaff',
      publicMessage: 'Error listing assignable staff.',
    });
  }
});

exports.updateTask = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const task = await calendarService.updateTask(access, req.params.id, req.body, req);
    return apiResponse.success(res, { task });
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.updateTask',
      publicMessage: 'Error updating calendar task.',
    });
  }
});

exports.deleteTask = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const data = await calendarService.deleteTask(access, req.params.id, req);
    return apiResponse.success(res, data);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.deleteTask',
      publicMessage: 'Error deleting calendar task.',
    });
  }
});

exports.updateTaskStatus = asyncHandler(async (req, res, next) => {
  try {
    const access = requireCalendarView(req, res);
    if (!access) return;
    const task = await calendarService.updateTaskStatus(
      access,
      req.params.id,
      req.body.status,
      req
    );
    return apiResponse.success(res, { task });
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.calendar.updateTaskStatus',
      publicMessage: 'Error updating task status.',
    });
  }
});

exports.moveEvent = asyncHandler(async (req, res, next) => {
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

exports.resizeEvent = asyncHandler(async (req, res, next) => {
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

exports.cancelReservation = asyncHandler(async (req, res, next) => {
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
