const roleSql = require('../sql/roleSqlService');
const permissionSql = require('../sql/permissionSqlService');
const userRoleSql = require('../sql/userRoleSqlService');
const userSql = require('../sql/userSqlService');
const sessionSql = require('../sql/sessionSqlService');
const { runWithTransaction, clientQuery } = require('../../db/transaction');

const OWNER_SLUG = 'owner';

function createHttpError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

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

function userHasPermission(access, permissionKey) {
  if (!access) return false;
  if ((access.roles || []).includes(OWNER_SLUG)) return true;
  return (access.permissions || []).includes(permissionKey);
}

function userHasAnyPermission(access, keys) {
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
  if (!access) return false;
  if ((access.roles || []).length > 0) return true;
  if ((access.permissions || []).length > 0) return true;
  return false;
}

function computeLegacyRoleFromAssigned(assigned) {
  const slugs = (assigned || [])
    .map((r) => r.roleSlug || r.slug)
    .filter(Boolean);
  if (slugs.includes(OWNER_SLUG)) return 'admin';
  if (slugs.length > 0) return 'staff';
  return 'user';
}

async function updateUserLegacyRole(userId, role, client) {
  await clientQuery(
    client,
    `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1`,
    [Number(userId), role]
  );
}

async function syncUserLegacyRole(userId, assigned, client) {
  await updateUserLegacyRole(userId, computeLegacyRoleFromAssigned(assigned), client);
}

async function assertCanRemoveOwner(userId, client) {
  const currentlyOwner = await userRoleSql.userHasRoleSlug(userId, OWNER_SLUG, client);
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

async function setUserRoles(userId, roleIds, assignedByUserId = null) {
  const result = await runWithTransaction(async (client) => {
    const user = await userSql.findUserById(userId, client);
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

async function assignUserRole(userId, roleId, assignedByUserId = null) {
  const result = await runWithTransaction(async (client) => {
    const user = await userSql.findUserById(userId, client);
    if (!user) throw createHttpError('NOT_FOUND', 'User not found.', 404);

    const role = await roleSql.findRoleById(roleId, client);
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

async function revokeUserRole(userId, roleId) {
  const result = await runWithTransaction(async (client) => {
    const user = await userSql.findUserById(userId, client);
    if (!user) throw createHttpError('NOT_FOUND', 'User not found.', 404);

    const role = await roleSql.findRoleById(roleId, client);
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

async function updateRolePermissions(roleId, permissionKeys) {
  const result = await runWithTransaction(async (client) => {
    const role = await roleSql.findRoleById(roleId, client);
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
