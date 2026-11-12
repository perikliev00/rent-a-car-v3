/**
 * Admin RBAC catalog and role-permission updates.
 */
const express = require('express');
// Require the '../../../controllers/api/admin/rbacController' module as rbacController.
const rbacController = require('../../../controllers/api/admin/rbacController');
// Destructure object properties into local variables.
const { requirePermission } = require('../../../middleware/auth');

// Create the router constant.
const router = express.Router();
// Create the can manage users constant.
const canManageUsers = requirePermission('can_manage_users');

// Full roles + permissions catalog for the admin RBAC UI.
router.get('/', canManageUsers, rbacController.getCatalog);
// Replace the permission set for one role.
router.put('/roles/:roleId/permissions', canManageUsers, rbacController.updateRolePermissions);

// Assign the CommonJS module exports.
module.exports = router;
