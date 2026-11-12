/**
 * Admin fleet alert listing and reconcile handlers.
 */
const carAdminService = require('../../../../services/admin/carAdminService');
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
const apiResponse = require('../../../../utils/apiResponse');
const asyncHandler = require('../../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../../utils/controllerError');

/**
 * Return current fleet alert summary (compliance expiry, maintenance, etc.).
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
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

/**
 * Reconcile fleet alerts as of now and return updated summary.
 * Side effects: recomputes alert rows, writes an admin audit log entry.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const reconcileFleetAlerts = asyncHandler(async (req, res, next) => {
  try {
    const result = await carAdminService.reconcileFleetAlerts(new Date());
    await logAdminAction(req, {
      action: 'admin.reconciled_fleet_alerts',
      entityType: 'fleet_alerts',
      metadata: result || {},
    });
    // Re-read after reconcile so the UI gets a consistent snapshot.
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
