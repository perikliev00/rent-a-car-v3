/**
 * Admin user listing and role assignment routes.
 */
const express = require('express');
// Require the '../../../controllers/api/admin/userController' module as userController.
const userController = require('../../../controllers/api/admin/userController');
// Destructure object properties into local variables.
const { requirePermission } = require('../../../middleware/auth');

// Create the router constant.
const router = express.Router();
// Create the can manage users constant.
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

// Assign the CommonJS module exports.
module.exports = router;
