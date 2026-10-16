/**
 * Role-based access control: resolve user roles/permissions, assign/revoke roles,
 * and update role permission matrices. Owner always has all permissions.
 * Role changes destroy affected sessions so stale cookies cannot retain old rights.
 */
const roleSql = require('../sql/roleSqlService');
const permissionSql = require('../sql/permissionSqlService');
const userRoleSql = require('../sql/userRoleSqlService');
const userSql = require('../sql/userSqlService');
const sessionSql = require('../sql/sessionSqlService');
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
  const err = new Error(message);
  err.code = code;
  err.status = status;
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
  const roleRows = await userRoleSql.listRolesForUser(userId, client);
  const roles = roleRows.map((r) => r.roleSlug).filter(Boolean);
  const roleIds = roleRows.map((r) => Number(r.roleId));

  const isOwner = roles.includes(OWNER_SLUG);
  let permissions;
  if (isOwner) {
    const all = await permissionSql.listPermissions(client);
    permissions = all.map((p) => p.key);
  } else {
    permissions = await permissionSql.listPermissionKeysForRoleIds(roleIds, client);
  }

  return {
    roles,
    permissions,
    roleDetails: roleRows.map((r) => ({
      id: r.roleId,
      slug: r.roleSlug,
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
  if ((access.roles || []).includes(OWNER_SLUG)) return true;
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
  if ((access.roles || []).includes(OWNER_SLUG)) return true;
  const set = new Set(access.permissions || []);
  return (keys || []).some((k) => set.has(k));
}

/**
 * Staff access is determined only by RBAC (`user_roles` / derived permissions).
 * `users.role` is a denormalized cache and must never grant access on its own.
 */
function isStaffAccess(access) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!access) return false;
  if ((access.roles || []).length > 0) return true;
  if ((access.permissions || []).length > 0) return true;
  return false;
}

/**
 * compute legacy role from assigned.
 * @param {*} assigned
 * @returns {*}
 */
function computeLegacyRoleFromAssigned(assigned) {
  const slugs = (assigned || [])
    .map((r) => r.roleSlug || r.slug)
    .filter(Boolean);
  if (slugs.includes(OWNER_SLUG)) return 'admin';
  if (slugs.length > 0) return 'staff';
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
  await clientQuery(
    client,
    `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1`,
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
  await updateUserLegacyRole(userId, computeLegacyRoleFromAssigned(assigned), client);
}

/**
 * assert can remove owner.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function assertCanRemoveOwner(userId, client) {
  const currentlyOwner = await userRoleSql.userHasRoleSlug(userId, OWNER_SLUG, client);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!currentlyOwner) return;

  const ownerCount = await userRoleSql.countUsersWithRoleSlug(OWNER_SLUG, client);
  if (ownerCount <= 1) {
    throw createHttpError(
      'LAST_OWNER',
      'Cannot remove the last owner role from the system.',
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
    const user = await userSql.findUserById(userId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!user) {
      throw createHttpError('NOT_FOUND', 'User not found.', 404);
    }

    const uniqueIds = [...new Set((roleIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    const roles = await roleSql.findRolesByIds(uniqueIds, client);
    if (roles.length !== uniqueIds.length) {
      throw createHttpError('VALIDATION_ERROR', 'One or more role ids are invalid.', 422);
    }

    const ownerRole = await roleSql.findRoleBySlug(OWNER_SLUG, client);
    const nextHasOwner = ownerRole && uniqueIds.includes(Number(ownerRole.id));
    // Guard: early-return or throw when required input is missing/invalid.
    if (!nextHasOwner) {
      await assertCanRemoveOwner(userId, client);
    }

    const assigned = await userRoleSql.replaceUserRoles(
      userId,
      uniqueIds,
      assignedByUserId,
      client
    );

    await syncUserLegacyRole(userId, assigned, client);

    return {
      userId: String(userId),
      roles: assigned.map((r) => ({
        id: r.roleId,
        slug: r.roleSlug,
        name: r.roleName,
      })),
    };
  });
  await sessionSql.destroySessionsForUser(userId);
  return result;
}

/** Assign one role; syncs legacy users.role cache and destroys sessions. */
async function assignUserRole(userId, roleId, assignedByUserId = null) {
  // Open a DB transaction so writes commit atomically.
  const result = await runWithTransaction(async (client) => {
    const user = await userSql.findUserById(userId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!user) throw createHttpError('NOT_FOUND', 'User not found.', 404);

    const role = await roleSql.findRoleById(roleId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!role) throw createHttpError('NOT_FOUND', 'Role not found.', 404);

    const assigned = await userRoleSql.assignRoleToUser(
      userId,
      roleId,
      assignedByUserId,
      client
    );

    await syncUserLegacyRole(userId, assigned, client);

    return {
      userId: String(userId),
      roles: assigned.map((r) => ({
        id: r.roleId,
        slug: r.roleSlug,
        name: r.roleName,
      })),
    };
  });
  await sessionSql.destroySessionsForUser(userId);
  return result;
}

/** Revoke one role; cannot revoke the last owner. */
async function revokeUserRole(userId, roleId) {
  // Open a DB transaction so writes commit atomically.
  const result = await runWithTransaction(async (client) => {
    const user = await userSql.findUserById(userId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!user) throw createHttpError('NOT_FOUND', 'User not found.', 404);

    const role = await roleSql.findRoleById(roleId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!role) throw createHttpError('NOT_FOUND', 'Role not found.', 404);

    if (role.slug === OWNER_SLUG) {
      await assertCanRemoveOwner(userId, client);
    }

    const assigned = await userRoleSql.revokeRoleFromUser(userId, roleId, client);
    await syncUserLegacyRole(userId, assigned, client);

    return {
      userId: String(userId),
      roles: assigned.map((r) => ({
        id: r.roleId,
        slug: r.roleSlug,
        name: r.roleName,
      })),
    };
  });
  await sessionSql.destroySessionsForUser(userId);
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
    const role = await roleSql.findRoleById(roleId, client);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!role) throw createHttpError('NOT_FOUND', 'Role not found.', 404);

    if (role.slug === OWNER_SLUG) {
      throw createHttpError(
        'OWNER_LOCKED',
        'Owner role always has all permissions and cannot be edited.',
        409
      );
    }

    const keys = [...new Set((permissionKeys || []).map((k) => String(k).trim()).filter(Boolean))];
    const perms = await permissionSql.findPermissionsByKeys(keys, client);
    if (perms.length !== keys.length) {
      throw createHttpError('VALIDATION_ERROR', 'One or more permission keys are invalid.', 422);
    }

    const applied = await permissionSql.replaceRolePermissions(
      roleId,
      perms.map((p) => p.id),
      client
    );

    await clientQuery(
      client,
      `UPDATE roles SET updated_at = NOW() WHERE id = $1`,
      [Number(roleId)]
    );

    return {
      roleId: String(role.id),
      roleSlug: role.slug,
      permissions: applied,
    };
  });
  await sessionSql.destroySessionsForRole(roleId);
  return result;
}

/**
 * Admin catalog: roles, permissions, and matrix (owner shown with all keys).
 * @returns {Promise<{ roles: object[], permissions: object[], matrix: object[] }>}
 */
async function getRbacCatalog() {
  const [roles, permissions, matrix] = await Promise.all([
    roleSql.listRoles(),
    permissionSql.listPermissions(),
    permissionSql.listRolePermissionMatrix(),
  ]);

  const allKeys = permissions.map((p) => p.key);
  const enriched = matrix.map((entry) => {
    if (entry.roleSlug === OWNER_SLUG) {
      return {
        ...entry,
        permissionKeys: allKeys,
        permissionIds: permissions.map((p) => p.id),
      };
    }
    return entry;
  });

  return { roles, permissions, matrix: enriched };
}

module.exports = {
  OWNER_SLUG,
  getUserAccess,
  userHasPermission,
  userHasAnyPermission,
  isStaffAccess,
  computeLegacyRoleFromAssigned,
  setUserRoles,
  assignUserRole,
  revokeUserRole,
  updateRolePermissions,
  getRbacCatalog,
};
