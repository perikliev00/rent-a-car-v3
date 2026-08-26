const bcrypt = require('bcrypt');
const userSql = require('../sql/userSqlService');
const userRoleSql = require('../sql/userRoleSqlService');
const roleSql = require('../sql/roleSqlService');
const tokenSql = require('../sql/emailVerificationTokenSqlService');
const rbacService = require('../rbac/rbacService');
const { runWithTransaction } = require('../../db/transaction');

function createHttpError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function isStaffManagedUser(user, assignedRoles) {
  if (user.role === 'staff' || user.role === 'admin') {
    return true;
  }
  return Array.isArray(assignedRoles) && assignedRoles.length > 0;
}

async function listUsers() {
  return userRoleSql.listStaffUsersWithRoles();
}

async function getUser(userId) {
  const user = await userSql.findUserById(userId);
  if (!user) {
    throw createHttpError('NOT_FOUND', 'User not found.', 404);
  }

  const access = await rbacService.getUserAccess(userId);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: access.roleDetails,
    permissions: access.permissions,
  };
}

async function createStaffUser({ email, password, roleIds = [] }) {
  if (!email || !password) {
    throw createHttpError('VALIDATION_ERROR', 'Email and password are required.', 422);
  }

  const uniqueIds = [...new Set((roleIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (uniqueIds.length === 0) {
    throw createHttpError('VALIDATION_ERROR', 'At least one role is required.', 422);
  }

  return runWithTransaction(async (client) => {
    const roles = await roleSql.findRolesByIds(uniqueIds, client);
    if (roles.length !== uniqueIds.length) {
      throw createHttpError('VALIDATION_ERROR', 'One or more role ids are invalid.', 422);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let user;
    try {
      user = await userSql.createUser(
        {
          email,
          password: hashedPassword,
          role: 'staff',
          emailVerified: true,
        },
        client
      );
    } catch (err) {
      if (err.code === 'EMAIL_IN_USE') {
        throw createHttpError('EMAIL_IN_USE', 'Email is already in use.', 409);
      }
      throw err;
    }

    const assigned = await userRoleSql.replaceUserRoles(user.id, uniqueIds, null, client);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: assigned.map((r) => ({
        id: r.roleId,
        slug: r.roleSlug,
        name: r.roleName,
      })),
    };
  });
}

async function updateStaffUser(userId, { email } = {}) {
  return runWithTransaction(async (client) => {
    const user = await userSql.lockUserByIdForUpdate(userId, client);
    if (!user) {
      throw createHttpError('NOT_FOUND', 'User not found.', 404);
    }

    const assignedRoles = await userRoleSql.listRolesForUser(userId, client);
    if (!isStaffManagedUser(user, assignedRoles)) {
      throw createHttpError('NOT_FOUND', 'User not found.', 404);
    }

    if (email != null) {
      const normalized = String(email).trim().toLowerCase();
      if (!normalized) {
        throw createHttpError('VALIDATION_ERROR', 'Email is required.', 422);
      }
      try {
        await userSql.updateEmailKeepingVerification(userId, normalized, client);
      } catch (err) {
        if (err.code === 'EMAIL_IN_USE') {
          throw createHttpError('EMAIL_IN_USE', 'Email is already in use.', 409);
        }
        throw err;
      }
      await tokenSql.revokeActiveForUser(userId, client);
    }

    const updated = await userSql.findUserById(userId, client);
    const access = await rbacService.getUserAccess(userId);
    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      roles: access.roleDetails,
      permissions: access.permissions,
    };
  });
}

module.exports = {
  listUsers,
  getUser,
  createStaffUser,
  updateStaffUser,
};
