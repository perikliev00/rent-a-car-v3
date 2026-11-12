/**
 * HTTP handlers for calendar ops tasks and assignable-staff listing.
 */

const calendarService = require('../calendar.service');
// Destructure object properties into local variables.
const { sessionAccess } = require('../calendar.permissions');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../utils/controllerError');
// Destructure object properties into local variables.
const { mapServiceError, requireCalendarView } = require('./calendarControllerHelpers');

/** POST /tasks */
const createTask = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the event constant.
    const event = await calendarService.createTask(access, req.body, req);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { event }, 201);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.calendar.createTask',
      // Provide the public message field value.
      publicMessage: 'Error creating calendar task.',
    });
  }
});

/** GET /tasks — filtered ops-task list (VIEW_OWN scoped in service). */
const listTasks = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the data constant.
    const data = await calendarService.listTasks(access, req.query);
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.calendar.listTasks',
      // Provide the public message field value.
      publicMessage: 'Error listing calendar tasks.',
    });
  }
});

/** GET /assignable-staff — driver/cleaner/receptionist picker list. */
const listAssignableStaff = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = sessionAccess(req);
    // Create the data constant.
    const data = await calendarService.listAssignableStaff(access);
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.calendar.listAssignableStaff',
      // Provide the public message field value.
      publicMessage: 'Error listing assignable staff.',
    });
  }
});

/** PATCH /tasks/:id */
const updateTask = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the task constant.
    const task = await calendarService.updateTask(access, req.params.id, req.body, req);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { task });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.calendar.updateTask',
      // Provide the public message field value.
      publicMessage: 'Error updating calendar task.',
    });
  }
});

/** DELETE /tasks/:id */
const deleteTask = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the data constant.
    const data = await calendarService.deleteTask(access, req.params.id, req);
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.calendar.deleteTask',
      // Provide the public message field value.
      publicMessage: 'Error deleting calendar task.',
    });
  }
});

/** PATCH /tasks/:id/status — status-machine transition. */
const updateTaskStatus = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the task constant.
    const task = await calendarService.updateTaskStatus(
      // Contribute this line to the enclosing declaration or statement.
      access,
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.body.status,
      // Reference the identifier used by the enclosing expression.
      req
    );
    // Return the resulting value to the caller.
    return apiResponse.success(res, { task });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.calendar.updateTaskStatus',
      // Provide the public message field value.
      publicMessage: 'Error updating task status.',
    });
  }
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createTask,
  // Contribute this line to the enclosing declaration or statement.
  listTasks,
  // Contribute this line to the enclosing declaration or statement.
  listAssignableStaff,
  // Contribute this line to the enclosing declaration or statement.
  updateTask,
  // Contribute this line to the enclosing declaration or statement.
  deleteTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatus,
};
