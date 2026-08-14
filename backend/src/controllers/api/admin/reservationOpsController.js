const reservationOpsDashboardService = require('../../../services/admin/reservationOpsDashboardService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

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
