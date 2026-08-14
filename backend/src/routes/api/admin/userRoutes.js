const express = require('express');
const userController = require('../../../controllers/api/admin/userController');
const { requirePermission } = require('../../../middleware/auth');

const router = express.Router();
const canManageUsers = requirePermission('can_manage_users');

router.get('/', canManageUsers, userController.listUsers);
router.post('/', canManageUsers, userController.createUser);
router.get('/:id', canManageUsers, userController.getUser);
router.patch('/:id', canManageUsers, userController.updateUser);
router.put('/:id/roles', canManageUsers, userController.putUserRoles);
router.post('/:id/roles/:roleId', canManageUsers, userController.assignUserRole);
router.delete('/:id/roles/:roleId', canManageUsers, userController.revokeUserRole);

module.exports = router;
