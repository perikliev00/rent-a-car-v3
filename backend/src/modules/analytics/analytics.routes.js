/**
 * Staff analytics routes. Overview/series require revenue or export permission;
 * CSV export specifically requires can_export_reports.
 */

const express = require('express');
// Require the './analytics.controller' module as analyticsController.
const analyticsController = require('./analytics.controller');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  requireStaffApi,
  // Contribute this line to the enclosing declaration or statement.
  requireAnyPermission,
  // Contribute this line to the enclosing declaration or statement.
  requirePermission,
// Continue the surrounding logic with this statement.
} = require('../../middleware/auth');
// Require the '../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../middleware/validateRequest');
// Destructure object properties into local variables.
const { dateRangeQuery, carIdParam } = require('./analytics.validators');

// Create the router constant.
const router = express.Router();

// Create the can analytics constant.
const canAnalytics = [
  // Contribute this line to the enclosing declaration or statement.
  requireStaffApi,
  // Call requireAnyPermission to perform this step.
  requireAnyPermission(['can_view_revenue', 'can_export_reports']),
];

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/overview',
  // Spread canAnalytics into the surrounding structure.
  ...canAnalytics,
  // Contribute this line to the enclosing declaration or statement.
  dateRangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  analyticsController.getOverview
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/revenue-by-car',
  // Spread canAnalytics into the surrounding structure.
  ...canAnalytics,
  // Contribute this line to the enclosing declaration or statement.
  dateRangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  analyticsController.getRevenueByCar
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/revenue-by-location',
  // Spread canAnalytics into the surrounding structure.
  ...canAnalytics,
  // Contribute this line to the enclosing declaration or statement.
  dateRangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  analyticsController.getRevenueByLocation
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/utilization',
  // Spread canAnalytics into the surrounding structure.
  ...canAnalytics,
  // Contribute this line to the enclosing declaration or statement.
  dateRangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  analyticsController.getUtilization
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/cars',
  // Spread canAnalytics into the surrounding structure.
  ...canAnalytics,
  // Contribute this line to the enclosing declaration or statement.
  dateRangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  analyticsController.getCarsPerformance
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/cars/:carId',
  // Spread canAnalytics into the surrounding structure.
  ...canAnalytics,
  // Contribute this line to the enclosing declaration or statement.
  carIdParam,
  // Contribute this line to the enclosing declaration or statement.
  dateRangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  analyticsController.getCarPerformance
);

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/export.csv',
  // Contribute this line to the enclosing declaration or statement.
  requireStaffApi,
  // Call requirePermission to perform this step.
  requirePermission('can_export_reports'),
  // Contribute this line to the enclosing declaration or statement.
  dateRangeQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  analyticsController.exportCsv
);

// Assign the CommonJS module exports.
module.exports = router;
