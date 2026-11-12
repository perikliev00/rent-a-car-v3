/**
 * HTTP handlers for manual calendar block create / update / delete.
 */

const calendarService = require('../calendar.service');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../utils/controllerError');
// Destructure object properties into local variables.
const { mapServiceError, requireCalendarView } = require('./calendarControllerHelpers');

/** POST /manual-events */
const createManualEvent = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the event constant.
    const event = await calendarService.createManualEvent(access, req.body, req);
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
      context: 'api.admin.calendar.createManualEvent',
      // Provide the public message field value.
      publicMessage: 'Error creating calendar block.',
    });
  }
});

/** PATCH /manual-events/:id */
const updateManualEvent = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the event constant.
    const event = await calendarService.updateManualEvent(access, req.params.id, req.body, req);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { event });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.calendar.updateManualEvent',
      // Provide the public message field value.
      publicMessage: 'Error updating calendar block.',
    });
  }
});

/** DELETE /manual-events/:id */
const deleteManualEvent = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the data constant.
    const data = await calendarService.deleteManualEvent(access, req.params.id, req);
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
      context: 'api.admin.calendar.deleteManualEvent',
      // Provide the public message field value.
      publicMessage: 'Error deleting calendar block.',
    });
  }
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  updateManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  deleteManualEvent,
};
