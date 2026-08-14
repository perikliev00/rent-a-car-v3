const express = require('express');
const rbacController = require('../../../controllers/api/admin/rbacController');
const { requirePermission } = require('../../../middleware/auth');

const router = express.Router();
const canManageUsers = requirePermission('can_manage_users');

router.get('/', canManageUsers, rbacController.getCatalog);
router.put('/roles/:roleId/permissions', canManageUsers, rbacController.updateRolePermissions);

module.exports = router;
