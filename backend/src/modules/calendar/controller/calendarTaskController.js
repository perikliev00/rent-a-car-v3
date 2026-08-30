const calendarService = require('../calendar.service');
const { sessionAccess } = require('../calendar.permissions');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');
const { mapServiceError, requireCalendarView } = require('./calendarControllerHelpers');

const createTask = asyncHandler(async (req, res, next) => {
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

const listTasks = asyncHandler(async (req, res, next) => {
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

const listAssignableStaff = asyncHandler(async (req, res, next) => {
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

const updateTask = asyncHandler(async (req, res, next) => {
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

const deleteTask = asyncHandler(async (req, res, next) => {
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

const updateTaskStatus = asyncHandler(async (req, res, next) => {
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

module.exports = {
  createTask,
  listTasks,
  listAssignableStaff,
  updateTask,
  deleteTask,
  updateTaskStatus,
};
