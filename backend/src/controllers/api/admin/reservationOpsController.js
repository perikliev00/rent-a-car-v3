/**
 * Admin reservation operations dashboard handler.
 */
const reservationOpsDashboardService = require('../../../services/admin/reservationOpsDashboardService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
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
  try {
    const limit = req.query.limit != null ? Number(req.query.limit) : 20;
    const data = await reservationOpsDashboardService.getOpsDashboard({ limit });
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getAdminReservationOpsDashboard',
      publicMessage: 'Error loading reservation ops dashboard.',
    });
  }
});
