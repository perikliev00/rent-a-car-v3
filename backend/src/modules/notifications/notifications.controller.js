/**
 * Admin HTTP handlers for notification inbox and manual scheduler runs.
 */

const notificationsService = require('./notifications.service');
// Require the '../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../utils/apiResponse');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../utils/controllerError');

/** GET / — paginated notification rows. */
exports.list = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await notificationsService.listForAdmin({
      // Provide the limit field value.
      limit: req.query.limit,
      // Provide the offset field value.
      offset: req.query.offset,
      // Provide the status field value.
      status: req.query.status || null,
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.notifications.list',
      // Provide the public message field value.
      publicMessage: 'Error loading notifications.',
    });
  }
});

/** POST /run-scheduler — enqueue due reminders then process the worker queue. */
exports.runScheduler = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { runNotificationScheduler } = require('./notifications.scheduler');
    // Destructure object properties into local variables.
    const { processDueNotifications } = require('./notifications.worker');
    // Create the enqueued constant.
    const enqueued = await runNotificationScheduler();
    // Create the processed constant.
    const processed = await processDueNotifications({ limit: 100 });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { enqueued, processed });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.notifications.runScheduler',
      // Provide the public message field value.
      publicMessage: 'Error running notification scheduler.',
    });
  }
});
