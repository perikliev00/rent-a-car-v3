/**
 * Role-based access control: resolve user roles/permissions, assign/revoke roles,
 * and update role permission matrices. Owner always has all permissions.
 * Role changes destroy affected sessions so stale cookies cannot retain old rights.
 */
const roleSql = require('../sql/roleSqlService');
// Require the '../sql/permissionSqlService' module as permissionSql.
const permissionSql = require('../sql/permissionSqlService');
// Require the '../sql/userRoleSqlService' module as userRoleSql.
const userRoleSql = require('../sql/userRoleSqlService');
// Require the '../sql/userSqlService' module as userSql.
const userSql = require('../sql/userSqlService');
// Require the '../sql/sessionSqlService' module as sessionSql.
const sessionSql = require('../sql/sessionSqlService');
// Destructure object properties into local variables.
const { runWithTransaction, clientQuery } = require('../../db/transaction');

/** Privileged role slug that implicitly grants every permission key. */
const OWNER_SLUG = 'owner';

/**
 * Insert http error and return the mapped result.
 * @param {*} code
 * @param {string} message
 * @param {string} [status]
 * @returns {*}
 */
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

/**
 * Load roles and effective permission keys for a user.
 * Owners receive the full permission catalog regardless of role_permissions rows.
 *
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<{ roles: string[], permissions: string[], roleDetails: object[] }>}
 */
async function getUserAccess(userId, client = null) {
  // Create the role rows constant.
  const roleRows = await userRoleSql.listRolesForUser(userId, client);
  // Create the roles constant.
  const roles = roleRows.map((r) => r.roleSlug).filter(Boolean);
  // Create the role ids constant.
  const roleIds = roleRows.map((r) => Number(r.roleId));

  // Create the is owner constant.
  const isOwner = roles.includes(OWNER_SLUG);
  // Reserve the permissions variable for later assignment.
  let permissions;
  // Evaluate the condition and enter the branch when it is true.
  if (isOwner) {
    // Create the all constant.
    const all = await permissionSql.listPermissions(client);
    // Update permissions with the right-hand side value.
    permissions = all.map((p) => p.key);
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Store the awaited result in permissions.
    permissions = await permissionSql.listPermissionKeysForRoleIds(roleIds, client);
  }

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    roles,
    // Contribute this line to the enclosing declaration or statement.
    permissions,
    // Provide the role details field value.
    roleDetails: roleRows.map((r) => ({
      // Provide the id field value.
      id: r.roleId,
      // Provide the slug field value.
      slug: r.roleSlug,
      // Provide the name field value.
      name: r.roleName,
    })),
  };
}

/**
 * user has permission.
 * @param {object} access
 * @param {string} permissionKey
 * @returns {*}
 */
function userHasPermission(access, permissionKey) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!access) return false;
  // Evaluate the condition and enter the branch when it is true.
  if ((access.roles || []).includes(OWNER_SLUG)) return true;
  // Return the resulting value to the caller.
  return (access.permissions || []).includes(permissionKey);
}

/**
 * user has any permission.
 * @param {object} access
 * @param {Array<*>} keys
 * @returns {*}
 */
function userHasAnyPermission(access, keys) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!access) return false;
  // Evaluate the condition and enter the branch when it is true.
  if ((access.roles || []).includes(OWNER_SLUG)) return true;
  // Create the set constant.
  const set = new Set(access.permissions || []);
  // Return the resulting value to the caller.
  return (keys || []).some((k) => set.has(k));
}

/**
 * Staff access is determined only by RBAC (`user_roles` / derived permissions).
 * `users.role` is a denormalized cache and must never grant access on its own.
 */
function isStaffAccess(access) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!access) return false;
  // Evaluate the condition and enter the branch when it is true.
  if ((access.roles || []).length > 0) return true;
  // Evaluate the condition and enter the branch when it is true.
  if ((access.permissions || []).length > 0) return true;
  // Return the resulting value to the caller.
  return false;
}

/**
 * compute legacy role from assigned.
 * @param {*} assigned
 * @returns {*}
 */
function computeLegacyRoleFromAssigned(assigned) {
  // Create the slugs constant.
  const slugs = (assigned || [])
    // Call .map to perform this step.
    .map((r) => r.roleSlug || r.slug)
    // Call .filter to perform this step.
    .filter(Boolean);
  // Evaluate the condition and enter the branch when it is true.
  if (slugs.includes(OWNER_SLUG)) return 'admin';
  // Evaluate the condition and enter the branch when it is true.
  if (slugs.length > 0) return 'staff';
  // Return the resulting value to the caller.
  return 'user';
}

/**
 * Update or upsert user legacy role; returns null when not found.
 * @param {string|number} userId
 * @param {*} role
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function updateUserLegacyRole(userId, role, client) {
  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1`,
    // Continue the surrounding logic with this statement.
    [Number(userId), role]
  );
}

/**
 * sync user legacy role.
 * @param {string|number} userId
 * @param {*} assigned
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function syncUserLegacyRole(userId, assigned, client) {
  // Wait until the asynchronous operation resolves.
  await updateUserLegacyRole(userId, computeLegacyRoleFromAssigned(assigned), client);
}

/**
 * assert can remove owner.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function assertCanRemoveOwner(userId, client) {
  // Create the currently owner constant.
  const currentlyOwner = await userRoleSql.userHasRoleSlug(userId, OWNER_SLUG, client);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!currentlyOwner) return;

  // Create the owner count constant.
  const ownerCount = await userRoleSql.countUsersWithRoleSlug(OWNER_SLUG, client);
  // Evaluate the condition and enter the branch when it is true.
  if (ownerCount <= 1) {
    // Throw an error to stop the current control flow.
    throw createHttpError(
      // Supply the literal value used by the enclosing expression.
      'LAST_OWNER',
      // Supply the literal value used by the enclosing expression.
      'Cannot remove the last owner role from the system.',
      // Supply the literal value used by the enclosing expression.
      409
    );
  }
}

/**
 * Replace a user's roles atomically; refuses to remove the last owner.
 * Destroys all sessions for the user after commit.
 *
 * @param {string|number} userId
 * @param {Array<string|number>} roleIds
 * @param {string|number|null} [assignedByUserId]
 */
async function setUserRoles(userId, roleIds, assignedByUserId = null) {
  // Open a DB transaction so writes commit atomically.
  const result = await runWithTransaction(async (client) => {
    // Create the user constant.
    const user = await userSql.findUserById(userId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!user) {
      // Throw an error to stop the current control flow.
      throw createHttpError('NOT_FOUND', 'User not found.', 404);
    }

    // Create the unique ids constant.
    const uniqueIds = [...new Set((roleIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    // Create the roles constant.
    const roles = await roleSql.findRolesByIds(uniqueIds, client);
    // Evaluate the condition and enter the branch when it is true.
    if (roles.length !== uniqueIds.length) {
      // Throw an error to stop the current control flow.
      throw createHttpError('VALIDATION_ERROR', 'One or more role ids are invalid.', 422);
    }

    // Create the owner role constant.
    const ownerRole = await roleSql.findRoleBySlug(OWNER_SLUG, client);
    // Create the next has owner constant.
    const nextHasOwner = ownerRole && uniqueIds.includes(Number(ownerRole.id));
    // Guard: early-return or throw when required input is missing/invalid.
    if (!nextHasOwner) {
      // Wait until the asynchronous operation resolves.
      await assertCanRemoveOwner(userId, client);
    }

    // Create the assigned constant.
    const assigned = await userRoleSql.replaceUserRoles(
      // Contribute this line to the enclosing declaration or statement.
      userId,
      // Contribute this line to the enclosing declaration or statement.
      uniqueIds,
      // Contribute this line to the enclosing declaration or statement.
      assignedByUserId,
      // Reference the identifier used by the enclosing expression.
      client
    );

    // Wait until the asynchronous operation resolves.
    await syncUserLegacyRole(userId, assigned, client);

    // Return the resulting value to the caller.
    return {
      // Provide the user id field value.
      userId: String(userId),
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
  // Wait until the asynchronous operation resolves.
  await sessionSql.destroySessionsForUser(userId);
  // Return the resulting value to the caller.
  return result;
}

/** Assign one role; syncs legacy users.role cache and destroys sessions. */
async function assignUserRole(userId, roleId, assignedByUserId = null) {
  // Open a DB transaction so writes commit atomically.
  const result = await runWithTransaction(async (client) => {
    // Create the user constant.
    const user = await userSql.findUserById(userId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!user) throw createHttpError('NOT_FOUND', 'User not found.', 404);

    // Create the role constant.
    const role = await roleSql.findRoleById(roleId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!role) throw createHttpError('NOT_FOUND', 'Role not found.', 404);

    // Create the assigned constant.
    const assigned = await userRoleSql.assignRoleToUser(
      // Contribute this line to the enclosing declaration or statement.
      userId,
      // Contribute this line to the enclosing declaration or statement.
      roleId,
      // Contribute this line to the enclosing declaration or statement.
      assignedByUserId,
      // Reference the identifier used by the enclosing expression.
      client
    );

    // Wait until the asynchronous operation resolves.
    await syncUserLegacyRole(userId, assigned, client);

    // Return the resulting value to the caller.
    return {
      // Provide the user id field value.
      userId: String(userId),
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
  // Wait until the asynchronous operation resolves.
  await sessionSql.destroySessionsForUser(userId);
  // Return the resulting value to the caller.
  return result;
}

/** Revoke one role; cannot revoke the last owner. */
async function revokeUserRole(userId, roleId) {
  // Open a DB transaction so writes commit atomically.
  const result = await runWithTransaction(async (client) => {
    // Create the user constant.
    const user = await userSql.findUserById(userId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!user) throw createHttpError('NOT_FOUND', 'User not found.', 404);

    // Create the role constant.
    const role = await roleSql.findRoleById(roleId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!role) throw createHttpError('NOT_FOUND', 'Role not found.', 404);

    // Evaluate the condition and enter the branch when it is true.
    if (role.slug === OWNER_SLUG) {
      // Wait until the asynchronous operation resolves.
      await assertCanRemoveOwner(userId, client);
    }

    // Create the assigned constant.
    const assigned = await userRoleSql.revokeRoleFromUser(userId, roleId, client);
    // Wait until the asynchronous operation resolves.
    await syncUserLegacyRole(userId, assigned, client);

    // Return the resulting value to the caller.
    return {
      // Provide the user id field value.
      userId: String(userId),
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
  // Wait until the asynchronous operation resolves.
  await sessionSql.destroySessionsForUser(userId);
  // Return the resulting value to the caller.
  return result;
}

/**
 * Replace permission keys for a non-owner role; destroys sessions for that role.
 * @param {string|number} roleId
 * @param {string[]} permissionKeys
 */
async function updateRolePermissions(roleId, permissionKeys) {
  // Open a DB transaction so writes commit atomically.
  const result = await runWithTransaction(async (client) => {
    // Create the role constant.
    const role = await roleSql.findRoleById(roleId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!role) throw createHttpError('NOT_FOUND', 'Role not found.', 404);

    // Evaluate the condition and enter the branch when it is true.
    if (role.slug === OWNER_SLUG) {
      // Throw an error to stop the current control flow.
      throw createHttpError(
        // Supply the literal value used by the enclosing expression.
        'OWNER_LOCKED',
        // Supply the literal value used by the enclosing expression.
        'Owner role always has all permissions and cannot be edited.',
        // Supply the literal value used by the enclosing expression.
        409
      );
    }

    // Create the keys constant.
    const keys = [...new Set((permissionKeys || []).map((k) => String(k).trim()).filter(Boolean))];
    // Create the perms constant.
    const perms = await permissionSql.findPermissionsByKeys(keys, client);
    // Evaluate the condition and enter the branch when it is true.
    if (perms.length !== keys.length) {
      // Throw an error to stop the current control flow.
      throw createHttpError('VALIDATION_ERROR', 'One or more permission keys are invalid.', 422);
    }

    // Create the applied constant.
    const applied = await permissionSql.replaceRolePermissions(
      // Contribute this line to the enclosing declaration or statement.
      roleId,
      // Call perms.map to perform this step.
      perms.map((p) => p.id),
      // Reference the identifier used by the enclosing expression.
      client
    );

    // Wait until the asynchronous operation resolves.
    await clientQuery(
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Continue the surrounding logic with this statement.
      `UPDATE roles SET updated_at = NOW() WHERE id = $1`,
      // Continue the surrounding logic with this statement.
      [Number(roleId)]
    );

    // Return the resulting value to the caller.
    return {
      // Provide the role id field value.
      roleId: String(role.id),
      // Provide the role slug field value.
      roleSlug: role.slug,
      // Provide the permissions field value.
      permissions: applied,
    };
  });
  // Wait until the asynchronous operation resolves.
  await sessionSql.destroySessionsForRole(roleId);
  // Return the resulting value to the caller.
  return result;
}

/**
 * Admin catalog: roles, permissions, and matrix (owner shown with all keys).
 * @returns {Promise<{ roles: object[], permissions: object[], matrix: object[] }>}
 */
async function getRbacCatalog() {
  // Destructure array values into local variables.
  const [roles, permissions, matrix] = await Promise.all([
    // Call roleSql.listRoles to perform this step.
    roleSql.listRoles(),
    // Call permissionSql.listPermissions to perform this step.
    permissionSql.listPermissions(),
    // Call permissionSql.listRolePermissionMatrix to perform this step.
    permissionSql.listRolePermissionMatrix(),
  ]);

  // Create the all keys constant.
  const allKeys = permissions.map((p) => p.key);
  // Create the enriched constant.
  const enriched = matrix.map((entry) => {
    // Evaluate the condition and enter the branch when it is true.
    if (entry.roleSlug === OWNER_SLUG) {
      // Return the resulting value to the caller.
      return {
        // Spread entry into the surrounding structure.
        ...entry,
        // Provide the permission keys field value.
        permissionKeys: allKeys,
        // Provide the permission ids field value.
        permissionIds: permissions.map((p) => p.id),
      };
    }
    // Return the resulting value to the caller.
    return entry;
  });

  // Return the resulting value to the caller.
  return { roles, permissions, matrix: enriched };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  OWNER_SLUG,
  // Contribute this line to the enclosing declaration or statement.
  getUserAccess,
  // Contribute this line to the enclosing declaration or statement.
  userHasPermission,
  // Contribute this line to the enclosing declaration or statement.
  userHasAnyPermission,
  // Contribute this line to the enclosing declaration or statement.
  isStaffAccess,
  // Contribute this line to the enclosing declaration or statement.
  computeLegacyRoleFromAssigned,
  // Contribute this line to the enclosing declaration or statement.
  setUserRoles,
  // Contribute this line to the enclosing declaration or statement.
  assignUserRole,
  // Contribute this line to the enclosing declaration or statement.
  revokeUserRole,
  // Contribute this line to the enclosing declaration or statement.
  updateRolePermissions,
  // Contribute this line to the enclosing declaration or statement.
  getRbacCatalog,
};
