const dashboardService = require('../../../services/admin/dashboardService');
const rbacService = require('../../../services/rbac/rbacService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

exports.getDashboard = asyncHandler(async (req, res, next) => {
  try {
    const { orders, stats } = await dashboardService.getDashboardData();
    const access = {
      roles: req.session?.user?.roles || [],
      permissions: req.session?.user?.permissions || [],
    };
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
