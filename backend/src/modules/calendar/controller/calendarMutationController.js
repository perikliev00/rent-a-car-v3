/**
 * HTTP handlers for move/resize and calendar-initiated reservation cancel.
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

/** PATCH /events/:id/move */
const moveEvent = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the events constant.
    const events = await calendarService.moveOrResizeEvent(
      // Contribute this line to the enclosing declaration or statement.
      access,
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.body,
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Supply the literal value used by the enclosing expression.
      'move'
    );
    // Return the resulting value to the caller.
    return apiResponse.success(res, { events });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.calendar.moveEvent',
      // Provide the public message field value.
      publicMessage: 'Error moving calendar event.',
    });
  }
});

/** PATCH /events/:id/resize */
const resizeEvent = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the events constant.
    const events = await calendarService.moveOrResizeEvent(
      // Contribute this line to the enclosing declaration or statement.
      access,
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.body,
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Supply the literal value used by the enclosing expression.
      'resize'
    );
    // Return the resulting value to the caller.
    return apiResponse.success(res, { events });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.calendar.resizeEvent',
      // Provide the public message field value.
      publicMessage: 'Error resizing calendar event.',
    });
  }
});

/** POST /reservations/:id/cancel — calendar-initiated cancel. */
const cancelReservation = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = sessionAccess(req);
    // Create the data constant.
    const data = await calendarService.cancelReservationFromCalendar(
      // Contribute this line to the enclosing declaration or statement.
      access,
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Reference the identifier used by the enclosing expression.
      req
    );
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
      context: 'api.admin.calendar.cancelReservation',
      // Provide the public message field value.
      publicMessage: 'Error cancelling reservation.',
    });
  }
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  moveEvent,
  // Contribute this line to the enclosing declaration or statement.
  resizeEvent,
  // Contribute this line to the enclosing declaration or statement.
  cancelReservation,
};
