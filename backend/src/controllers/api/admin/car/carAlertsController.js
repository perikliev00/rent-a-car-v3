const carAdminService = require('../../../../services/admin/carAdminService');
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
const apiResponse = require('../../../../utils/apiResponse');
const asyncHandler = require('../../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../../utils/controllerError');

const getFleetAlerts = asyncHandler(async (req, res, next) => {
  try {
    const data = await carAdminService.getFleetAlerts();
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getFleetAlerts',
      publicMessage: 'Error loading fleet alerts.',
    });
  }
});

const reconcileFleetAlerts = asyncHandler(async (req, res, next) => {
  try {
    const result = await carAdminService.reconcileFleetAlerts(new Date());
    await logAdminAction(req, {
      action: 'admin.reconciled_fleet_alerts',
      entityType: 'fleet_alerts',
      metadata: result || {},
    });
    const data = await carAdminService.getFleetAlerts();
    return apiResponse.success(res, { reconcile: result, ...data });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.reconcileFleetAlerts',
      publicMessage: 'Error reconciling fleet alerts.',
    });
  }
});

module.exports = {
  getFleetAlerts,
  reconcileFleetAlerts,
};
