const express = require('express');
const auditLogController = require('../../../controllers/api/admin/auditLogController');
const { requirePermission } = require('../../../middleware/auth');
const validateRequest = require('../../../middleware/validateRequest');
const {
  adminAuditLogQueryValidationRules,
} = require('../../../validators/adminAuditLogQueryValidationRules');

const router = express.Router();

router.get(
  '/',
  requirePermission('can_view_audit_logs'),
  ...adminAuditLogQueryValidationRules,
  validateRequest,
  auditLogController.listAuditLogs
);

module.exports = router;
