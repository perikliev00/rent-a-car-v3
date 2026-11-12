/**
 * Staff routes for notification management (requires can_manage_notifications).
 */

const express = require('express');
// Require the './notifications.controller' module as notificationsController.
const notificationsController = require('./notifications.controller');
// Destructure object properties into local variables.
const { requireStaffApi, requirePermission } = require('../../middleware/auth');
// Require the '../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../middleware/validateRequest');
// Destructure object properties into local variables.
const { query } = require('express-validator');

// Create the router constant.
const router = express.Router();

// Create the list query constant.
const listQuery = [
  // Call query to perform this step.
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  // Call query to perform this step.
  query('offset').optional().isInt({ min: 0 }).toInt(),
  // Call query to perform this step.
  query('status')
    // Call .optional to perform this step.
    .optional()
    // Call .isIn to perform this step.
    .isIn(['pending', 'processing', 'sent', 'failed', 'cancelled']),
];

// Call router.get to perform this step.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/',
  // Contribute this line to the enclosing declaration or statement.
  requireStaffApi,
  // Call requirePermission to perform this step.
  requirePermission('can_manage_notifications'),
  // Contribute this line to the enclosing declaration or statement.
  listQuery,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  notificationsController.list
);

// Call router.post to perform this step.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/run-scheduler',
  // Contribute this line to the enclosing declaration or statement.
  requireStaffApi,
  // Call requirePermission to perform this step.
  requirePermission('can_manage_notifications'),
  // Contribute this line to the enclosing declaration or statement.
  notificationsController.runScheduler
);

// Assign the CommonJS module exports.
module.exports = router;
