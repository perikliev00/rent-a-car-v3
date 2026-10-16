/**
 * Admin dashboard summary handler.
 */
const dashboardService = require('../../../services/admin/dashboardService');
const rbacService = require('../../../services/rbac/rbacService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
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
  try {
    const { orders, stats } = await dashboardService.getDashboardData();
    const access = {
      roles: req.session?.user?.roles || [],
      permissions: req.session?.user?.permissions || [],
    };
    // Field-level RBAC: staff without revenue/orders perms get nulls / empty lists.
    const canViewRevenue = rbacService.userHasPermission(access, 'can_view_revenue');
    const canViewOrders = rbacService.userHasPermission(access, 'can_view_orders');

    const safeStats = {
      totalOrders: canViewOrders ? stats.totalOrders : null,
      pendingOrders: canViewOrders ? stats.pendingOrders : null,
      totalRevenue: canViewRevenue ? stats.totalRevenue : null,
    };

    return apiResponse.success(res, {
      orders: canViewOrders ? orders : [],
      stats: safeStats,
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getAdminDashboard',
      publicMessage: 'Error loading admin dashboard.',
    });
  }
});
