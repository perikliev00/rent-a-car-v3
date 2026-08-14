const express = require('express');
const analyticsController = require('./analytics.controller');
const {
  requireStaffApi,
  requireAnyPermission,
  requirePermission,
} = require('../../middleware/auth');
const validateRequest = require('../../middleware/validateRequest');
const { dateRangeQuery, carIdParam } = require('./analytics.validators');

const router = express.Router();

const canAnalytics = [
  requireStaffApi,
  requireAnyPermission(['can_view_revenue', 'can_export_reports']),
];

router.get(
  '/overview',
  ...canAnalytics,
  dateRangeQuery,
  validateRequest,
  analyticsController.getOverview
);

router.get(
  '/revenue-by-car',
  ...canAnalytics,
  dateRangeQuery,
  validateRequest,
  analyticsController.getRevenueByCar
);

router.get(
  '/revenue-by-location',
  ...canAnalytics,
  dateRangeQuery,
  validateRequest,
  analyticsController.getRevenueByLocation
);

router.get(
  '/utilization',
  ...canAnalytics,
  dateRangeQuery,
  validateRequest,
  analyticsController.getUtilization
);

router.get(
  '/cars',
  ...canAnalytics,
  dateRangeQuery,
  validateRequest,
  analyticsController.getCarsPerformance
);

router.get(
  '/cars/:carId',
  ...canAnalytics,
  carIdParam,
  dateRangeQuery,
  validateRequest,
  analyticsController.getCarPerformance
);

router.get(
  '/export.csv',
  requireStaffApi,
  requirePermission('can_export_reports'),
  dateRangeQuery,
  validateRequest,
  analyticsController.exportCsv
);

module.exports = router;
