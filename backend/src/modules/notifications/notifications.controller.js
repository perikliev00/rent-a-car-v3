const notificationsService = require('./notifications.service');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');

exports.list = asyncHandler(async (req, res, next) => {
  try {
    const data = await notificationsService.listForAdmin({
      limit: req.query.limit,
      offset: req.query.offset,
      status: req.query.status || null,
    });
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.admin.notifications.list',
      publicMessage: 'Error loading notifications.',
    });
  }
});

exports.runScheduler = asyncHandler(async (req, res, next) => {
  try {
    const { runNotificationScheduler } = require('./notifications.scheduler');
    const { processDueNotifications } = require('./notifications.worker');
    const enqueued = await runNotificationScheduler();
    const processed = await processDueNotifications({ limit: 100 });
    return apiResponse.success(res, { enqueued, processed });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.admin.notifications.runScheduler',
      publicMessage: 'Error running notification scheduler.',
    });
  }
});
