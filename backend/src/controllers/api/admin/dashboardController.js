/**
 * Admin dashboard summary handler.
 */
const dashboardService = require('../../../services/admin/dashboardService');
// Require the '../../../services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../services/rbac/rbacService');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../utils/controllerError');

/**
 * Return admin dashboard summary metrics, redacting fields the caller cannot view.
 * Side effects: reads dashboard aggregates; no writes.
 * @param {import('express').Request} req - Session must include staff roles/permissions
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getDashboard = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { orders, stats } = await dashboardService.getDashboardData();
    // Create the access constant.
    const access = {
      // Provide the roles field value.
      roles: req.session?.user?.roles || [],
      // Provide the permissions field value.
      permissions: req.session?.user?.permissions || [],
    };
    // Field-level RBAC: staff without revenue/orders perms get nulls / empty lists.
    const canViewRevenue = rbacService.userHasPermission(access, 'can_view_revenue');
    // Create the can view orders constant.
    const canViewOrders = rbacService.userHasPermission(access, 'can_view_orders');

    // Create the safe stats constant.
    const safeStats = {
      // Provide the total orders field value.
      totalOrders: canViewOrders ? stats.totalOrders : null,
      // Provide the pending orders field value.
      pendingOrders: canViewOrders ? stats.pendingOrders : null,
      // Provide the total revenue field value.
      totalRevenue: canViewRevenue ? stats.totalRevenue : null,
    };

    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Provide the orders field value.
      orders: canViewOrders ? orders : [],
      // Provide the stats field value.
      stats: safeStats,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getAdminDashboard',
      // Provide the public message field value.
      publicMessage: 'Error loading admin dashboard.',
    });
  }
});
