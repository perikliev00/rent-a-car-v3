/**
 * Admin fleet alert listing and reconcile handlers.
 */
const carAdminService = require('../../../../services/admin/carAdminService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
// Require the '../../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../../utils/apiResponse');
// Require the '../../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../../utils/asyncHandler');
// Destructure object properties into local variables.
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
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await carAdminService.getFleetAlerts();
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getFleetAlerts',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await carAdminService.reconcileFleetAlerts(new Date());
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.reconciled_fleet_alerts',
      // Provide the entity type field value.
      entityType: 'fleet_alerts',
      // Provide the metadata field value.
      metadata: result || {},
    });
    // Re-read after reconcile so the UI gets a consistent snapshot.
    const data = await carAdminService.getFleetAlerts();
    // Return the resulting value to the caller.
    return apiResponse.success(res, { reconcile: result, ...data });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.reconcileFleetAlerts',
      // Provide the public message field value.
      publicMessage: 'Error reconciling fleet alerts.',
    });
  }
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlerts,
};
