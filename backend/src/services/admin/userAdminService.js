const bcrypt = require('bcrypt');
const userSql = require('../sql/userSqlService');
const userRoleSql = require('../sql/userRoleSqlService');
const roleSql = require('../sql/roleSqlService');
const rbacService = require('../rbac/rbacService');
const { runWithTransaction, clientQuery } = require('../../db/transaction');

function createHttpError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
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
          emailVerifiedAt: new Date(),
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
  const user = await userSql.findUserById(userId);
  if (!user) {
    throw createHttpError('NOT_FOUND', 'User not found.', 404);
  }

  if (email != null) {
    const normalized = String(email).trim().toLowerCase();
    if (!normalized) {
      throw createHttpError('VALIDATION_ERROR', 'Email is required.', 422);
    }
    try {
      await clientQuery(
        null,
        `
        UPDATE users
        SET email = $2, updated_at = NOW()
        WHERE id = $1
        `,
        [Number(userId), normalized]
      );
    } catch (err) {
      if (err.code === '23505') {
        throw createHttpError('EMAIL_IN_USE', 'Email is already in use.', 409);
      }
      throw err;
    }
  }

  return getUser(userId);
}

module.exports = {
  listUsers,
  getUser,
  createStaffUser,
  updateStaffUser,
};
