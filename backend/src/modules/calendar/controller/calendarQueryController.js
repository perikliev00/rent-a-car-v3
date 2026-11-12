/**
 * HTTP handlers for calendar read endpoints (events, day, car, availability, conflicts, details).
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

/** GET /events — timeline/month payload for a from/to range. */
const getEvents = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the data constant.
    const data = await calendarService.getEvents({
      // Contribute this line to the enclosing declaration or statement.
      access,
      // Provide the from field value.
      from: req.query.from,
      // Provide the to field value.
      to: req.query.to,
      // Provide the density field value.
      density: req.query.density || 'timeline',
      // Provide the filters field value.
      filters: {
        // Provide the category id field value.
        categoryId: req.query.categoryId,
        // Provide the transmission field value.
        transmission: req.query.transmission,
        // Provide the fuel type field value.
        fuelType: req.query.fuelType,
        // Provide the car status field value.
        carStatus: req.query.carStatus,
        // Provide the location field value.
        location: req.query.location,
        // Provide the reservation status field value.
        reservationStatus: req.query.reservationStatus,
        // Provide the event type field value.
        eventType: req.query.eventType,
        // Provide the staff user id field value.
        staffUserId: req.query.staffUserId,
      },
    });
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
      context: 'api.admin.calendar.getEvents',
      // Provide the public message field value.
      publicMessage: 'Error loading calendar events.',
    });
  }
});

/** GET /day/:date — day-ops board for a Sofia calendar date. */
const getDay = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the data constant.
    const data = await calendarService.getDay(access, req.params.date);
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
      context: 'api.admin.calendar.getDay',
      // Provide the public message field value.
      publicMessage: 'Error loading day operations.',
    });
  }
});

/** GET /cars/:carId — single-car timeline for from/to. */
const getCar = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the data constant.
    const data = await calendarService.getCarTimeline(
      // Contribute this line to the enclosing declaration or statement.
      access,
      // Contribute this line to the enclosing declaration or statement.
      req.params.carId,
      // Contribute this line to the enclosing declaration or statement.
      req.query.from,
      // Contribute this line to the enclosing declaration or statement.
      req.query.to
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
      context: 'api.admin.calendar.getCar',
      // Provide the public message field value.
      publicMessage: 'Error loading car calendar.',
    });
  }
});

/** GET /availability — conflict preview for one car/range. */
const getAvailability = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the data constant.
    const data = await calendarService.getAvailability(
      // Contribute this line to the enclosing declaration or statement.
      access,
      // Contribute this line to the enclosing declaration or statement.
      req.query.carId,
      // Contribute this line to the enclosing declaration or statement.
      req.query.from,
      // Contribute this line to the enclosing declaration or statement.
      req.query.to
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
      context: 'api.admin.calendar.getAvailability',
      // Provide the public message field value.
      publicMessage: 'Error checking availability.',
    });
  }
});

/** GET /conflicts — fleet-wide conflict scan for a range. */
const getConflicts = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the data constant.
    const data = await calendarService.getConflicts(access, req.query.from, req.query.to);
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
      context: 'api.admin.calendar.getConflicts',
      // Provide the public message field value.
      publicMessage: 'Error loading conflicts.',
    });
  }
});

/** GET /events/:id — detail drawer payload for a composite event id. */
const getEventDetails = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the access constant.
    const access = requireCalendarView(req, res);
    // Evaluate the condition and enter the branch when it is true.
    if (!access) return;
    // Create the data constant.
    const data = await calendarService.getEventDetails(access, req.params.id);
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
      context: 'api.admin.calendar.getEventDetails',
      // Provide the public message field value.
      publicMessage: 'Error loading event details.',
    });
  }
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getEvents,
  // Contribute this line to the enclosing declaration or statement.
  getDay,
  // Contribute this line to the enclosing declaration or statement.
  getCar,
  // Contribute this line to the enclosing declaration or statement.
  getAvailability,
  // Contribute this line to the enclosing declaration or statement.
  getConflicts,
  // Contribute this line to the enclosing declaration or statement.
  getEventDetails,
};
