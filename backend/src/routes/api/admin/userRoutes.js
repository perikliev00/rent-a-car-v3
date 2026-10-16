/**
 * Admin user listing and role assignment routes.
 */
const express = require('express');
const userController = require('../../../controllers/api/admin/userController');
const { requirePermission } = require('../../../middleware/auth');

const router = express.Router();
const canManageUsers = requirePermission('can_manage_users');

// Paginated staff/customer user list.
router.get('/', canManageUsers, userController.listUsers);
// Create a new user (typically staff).
router.post('/', canManageUsers, userController.createUser);
// Single user detail including roles.
router.get('/:id', canManageUsers, userController.getUser);
// Patch profile / active flags.
router.patch('/:id', canManageUsers, userController.updateUser);
// Replace the full role set for a user.
router.put('/:id/roles', canManageUsers, userController.putUserRoles);
// Assign one additional role.
router.post('/:id/roles/:roleId', canManageUsers, userController.assignUserRole);
// Revoke one role assignment.
router.delete('/:id/roles/:roleId', canManageUsers, userController.revokeUserRole);

module.exports = router;
