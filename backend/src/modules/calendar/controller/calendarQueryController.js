/**
 * HTTP handlers for calendar read endpoints (events, day, car, availability, conflicts, details).
 */

const calendarService = require('../calendar.service');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');
const { mapServiceError, requireCalendarView } = require('./calendarControllerHelpers');

/** GET /events — timeline/month payload for a from/to range. */
const getEvents = asyncHandler(async (req, res, next) => {
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

/** GET /day/:date — day-ops board for a Sofia calendar date. */
const getDay = asyncHandler(async (req, res, next) => {
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

/** GET /cars/:carId — single-car timeline for from/to. */
const getCar = asyncHandler(async (req, res, next) => {
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

/** GET /availability — conflict preview for one car/range. */
const getAvailability = asyncHandler(async (req, res, next) => {
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

/** GET /conflicts — fleet-wide conflict scan for a range. */
const getConflicts = asyncHandler(async (req, res, next) => {
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

/** GET /events/:id — detail drawer payload for a composite event id. */
const getEventDetails = asyncHandler(async (req, res, next) => {
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

module.exports = {
  getEvents,
  getDay,
  getCar,
  getAvailability,
  getConflicts,
  getEventDetails,
};
