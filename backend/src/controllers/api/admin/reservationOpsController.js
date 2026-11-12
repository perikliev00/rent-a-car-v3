/**
 * Admin reservation operations dashboard handler.
 */
const reservationOpsDashboardService = require('../../../services/admin/reservationOpsDashboardService');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../utils/controllerError');

/**
 * Return reservation operations dashboard data (pickups, returns, attention queues).
 * Side effects: reads ops aggregates from the database (no writes).
 * @param {import('express').Request} req - Optional `limit` query (default 20)
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getOpsDashboard = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the limit constant.
    const limit = req.query.limit != null ? Number(req.query.limit) : 20;
    // Create the data constant.
    const data = await reservationOpsDashboardService.getOpsDashboard({ limit });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getAdminReservationOpsDashboard',
      // Provide the public message field value.
      publicMessage: 'Error loading reservation ops dashboard.',
    });
  }
});
