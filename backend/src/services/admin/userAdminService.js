/**
 * Admin staff-user CRUD: create/update staff accounts and attach RBAC roles.
 * User create + role assignment run in one transaction to avoid orphaned users.
 */
const bcrypt = require('bcrypt');
// Require the '../sql/userSqlService' module as userSql.
const userSql = require('../sql/userSqlService');
// Require the '../sql/userRoleSqlService' module as userRoleSql.
const userRoleSql = require('../sql/userRoleSqlService');
// Require the '../sql/roleSqlService' module as roleSql.
const roleSql = require('../sql/roleSqlService');
// Require the '../rbac/rbacService' module as rbacService.
const rbacService = require('../rbac/rbacService');
// Destructure object properties into local variables.
const { runWithTransaction, clientQuery } = require('../../db/transaction');

/** @param {string} code @param {string} message @param {number} [status] */
function createHttpError(code, message, status = 400) {
  // Create the err constant.
  const err = new Error(message);
  // Update err.code with the right-hand side value.
  err.code = code;
  // Update err.status with the right-hand side value.
  err.status = status;
  // Return the resulting value to the caller.
  return err;
}

/** List staff users with their assigned roles. */
async function listUsers() {
  // Return the resulting value to the caller.
  return userRoleSql.listStaffUsersWithRoles();
}

/**
 * Load one user plus resolved RBAC roles and permissions.
 * @param {number|string} userId
 */
async function getUser(userId) {
  // Create the user constant.
  const user = await userSql.findUserById(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!user) {
    // Throw an error to stop the current control flow.
    throw createHttpError('NOT_FOUND', 'User not found.', 404);
  }

  // Create the access constant.
  const access = await rbacService.getUserAccess(userId);
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: user.id,
    // Provide the email field value.
    email: user.email,
    // Provide the role field value.
    role: user.role,
    // Provide the created at field value.
    createdAt: user.createdAt,
    // Provide the updated at field value.
    updatedAt: user.updatedAt,
    // Provide the roles field value.
    roles: access.roleDetails,
    // Provide the permissions field value.
    permissions: access.permissions,
  };
}

/**
 * Create a staff user (pre-verified) and replace roles atomically.
 * Staff accounts skip email verification because admins create them.
 * @param {{email: string, password: string, roleIds?: number[]}} params
 */
async function createStaffUser({ email, password, roleIds = [] }) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!email || !password) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Email and password are required.', 422);
  }

  // Create the unique ids constant.
  const uniqueIds = [...new Set((roleIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  // Evaluate the condition and enter the branch when it is true.
  if (uniqueIds.length === 0) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'At least one role is required.', 422);
  }

  // Return the resulting value to the caller.
  return runWithTransaction(async (client) => {
    // Create the roles constant.
    const roles = await roleSql.findRolesByIds(uniqueIds, client);
    // Evaluate the condition and enter the branch when it is true.
    if (roles.length !== uniqueIds.length) {
      // Throw an error to stop the current control flow.
      throw createHttpError('VALIDATION_ERROR', 'One or more role ids are invalid.', 422);
    }

    // Create the hashed password constant.
    const hashedPassword = await bcrypt.hash(password, 10);
    // Reserve the user variable for later assignment.
    let user;
    // Protected block: isolate failure modes.
    try {
      // Store the awaited result in user.
      user = await userSql.createUser(
        {
          // Contribute this line to the enclosing declaration or statement.
          email,
          // Provide the password field value.
          password: hashedPassword,
          // Provide the role field value.
          role: 'staff',
          // Provide the email verified at field value.
          emailVerifiedAt: new Date(),
        },
        // Reference the identifier used by the enclosing expression.
        client
      );
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Evaluate the condition and enter the branch when it is true.
      if (err.code === 'EMAIL_IN_USE') {
        // Throw an error to stop the current control flow.
        throw createHttpError('EMAIL_IN_USE', 'Email is already in use.', 409);
      }
      // Throw an error to stop the current control flow.
      throw err;
    }

    // Create the assigned constant.
    const assigned = await userRoleSql.replaceUserRoles(user.id, uniqueIds, null, client);
    // Return the resulting value to the caller.
    return {
      // Provide the id field value.
      id: user.id,
      // Provide the email field value.
      email: user.email,
      // Provide the role field value.
      role: user.role,
      // Provide the created at field value.
      createdAt: user.createdAt,
      // Provide the updated at field value.
      updatedAt: user.updatedAt,
      // Provide the roles field value.
      roles: assigned.map((r) => ({
        // Provide the id field value.
        id: r.roleId,
        // Provide the slug field value.
        slug: r.roleSlug,
        // Provide the name field value.
        name: r.roleName,
      })),
    };
  });
}

/**
 * Update staff email; maps Postgres unique-violation to EMAIL_IN_USE.
 * @param {number|string} userId
 * @param {{email?: string}} [fields]
 */
async function updateStaffUser(userId, { email } = {}) {
  // Create the user constant.
  const user = await userSql.findUserById(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!user) {
    // Throw an error to stop the current control flow.
    throw createHttpError('NOT_FOUND', 'User not found.', 404);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (email != null) {
    // Create the normalized constant.
    const normalized = String(email).trim().toLowerCase();
    // Guard: early-return or throw when required input is missing/invalid.
    if (!normalized) {
      // Throw an error to stop the current control flow.
      throw createHttpError('VALIDATION_ERROR', 'Email is required.', 422);
    }
    // Protected block: isolate failure modes.
    try {
      // Wait until the asynchronous operation resolves.
      await clientQuery(
        // Supply the literal value used by the enclosing expression.
        null,
        // Continue the surrounding logic with this statement.
        `
        UPDATE users
        SET email = $2, updated_at = NOW()
        WHERE id = $1
        `,
        // Continue the surrounding logic with this statement.
        [Number(userId), normalized]
      );
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // 23505 = unique_violation on users.email
      if (err.code === '23505') {
        // Throw an error to stop the current control flow.
        throw createHttpError('EMAIL_IN_USE', 'Email is already in use.', 409);
      }
      // Throw an error to stop the current control flow.
      throw err;
    }
  }

  // Return the resulting value to the caller.
  return getUser(userId);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listUsers,
  // Contribute this line to the enclosing declaration or statement.
  getUser,
  // Contribute this line to the enclosing declaration or statement.
  createStaffUser,
  // Contribute this line to the enclosing declaration or statement.
  updateStaffUser,
};
