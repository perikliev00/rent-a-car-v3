/**
 * Admin audit-log listing endpoint.
 */
const express = require('express');
// Require the '../../../controllers/api/admin/auditLogController' module as auditLogController.
const auditLogController = require('../../../controllers/api/admin/auditLogController');
// Destructure object properties into local variables.
const { requirePermission } = require('../../../middleware/auth');
// Require the '../../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../../middleware/validateRequest');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  adminAuditLogQueryValidationRules,
// Continue the surrounding logic with this statement.
} = require('../../../validators/adminAuditLogQueryValidationRules');

// Create the router constant.
const router = express.Router();

// Filterable audit trail for compliance / debugging.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/',
  // Call requirePermission to perform this step.
  requirePermission('can_view_audit_logs'),
  // Spread adminAuditLogQueryValidationRules into the surrounding structure.
  ...adminAuditLogQueryValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  auditLogController.listAuditLogs
);

// Assign the CommonJS module exports.
module.exports = router;
