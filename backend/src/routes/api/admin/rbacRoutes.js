/**
 * Admin RBAC catalog and role-permission updates.
 */
const express = require('express');
const rbacController = require('../../../controllers/api/admin/rbacController');
const { requirePermission } = require('../../../middleware/auth');

const router = express.Router();
const canManageUsers = requirePermission('can_manage_users');

// Full roles + permissions catalog for the admin RBAC UI.
router.get('/', canManageUsers, rbacController.getCatalog);
// Replace the permission set for one role.
router.put('/roles/:roleId/permissions', canManageUsers, rbacController.updateRolePermissions);

module.exports = router;
