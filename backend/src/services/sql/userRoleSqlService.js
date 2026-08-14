const { clientQuery } = require('../../db/transaction');

function mapUserRole(row) {
  if (!row) return null;
  return {
    userId: String(row.user_id),
    roleId: String(row.role_id),
    roleSlug: row.role_slug || null,
    roleName: row.role_name || null,
    assignedByUserId: row.assigned_by_user_id != null ? String(row.assigned_by_user_id) : null,
    assignedAt: row.assigned_at,
  };
}

async function listRolesForUser(userId, client = null) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) return [];

  const result = await clientQuery(
    client,
    `
    SELECT
      ur.user_id,
      ur.role_id,
      ur.assigned_by_user_id,
      ur.assigned_at,
      r.slug AS role_slug,
      r.name AS role_name
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = $1
    ORDER BY r.name ASC
    `,
    [uid]
  );
  return result.rows.map(mapUserRole);
}

async function listRoleSlugsForUser(userId, client = null) {
  const roles = await listRolesForUser(userId, client);
  return roles.map((r) => r.roleSlug).filter(Boolean);
}

async function listRoleIdsForUser(userId, client = null) {
  const roles = await listRolesForUser(userId, client);
  return roles.map((r) => Number(r.roleId));
}

async function countUsersWithRoleSlug(slug, client = null) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return 0;
  const result = await clientQuery(
    client,
    `
    SELECT COUNT(*)::int AS count
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.slug = $1
    `,
    [normalized]
  );
  return result.rows[0]?.count || 0;
}

async function userHasRoleSlug(userId, slug, client = null) {
  const uid = Number(userId);
  const normalized = String(slug || '').trim().toLowerCase();
  if (!Number.isInteger(uid) || uid <= 0 || !normalized) return false;

  const result = await clientQuery(
    client,
    `
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = $1 AND r.slug = $2
    LIMIT 1
    `,
    [uid, normalized]
  );
  return result.rows.length > 0;
}

async function assignRoleToUser(userId, roleId, assignedByUserId = null, client = null) {
  const uid = Number(userId);
  const rid = Number(roleId);
  const by = assignedByUserId != null ? Number(assignedByUserId) : null;
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(rid) || rid <= 0) {
    throw new Error('Invalid user or role id');
  }

  await clientQuery(
    client,
    `
    INSERT INTO user_roles (user_id, role_id, assigned_by_user_id, assigned_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    [uid, rid, Number.isInteger(by) && by > 0 ? by : null]
  );

  return listRolesForUser(uid, client);
}

async function revokeRoleFromUser(userId, roleId, client = null) {
  const uid = Number(userId);
  const rid = Number(roleId);
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(rid) || rid <= 0) {
    throw new Error('Invalid user or role id');
  }

  await clientQuery(
    client,
    `
    DELETE FROM user_roles
    WHERE user_id = $1 AND role_id = $2
    `,
    [uid, rid]
  );

  return listRolesForUser(uid, client);
}

async function replaceUserRoles(userId, roleIds, assignedByUserId = null, client = null) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new Error('Invalid user id');
  }

  const ids = [...new Set(
    (roleIds || [])
      .map((v) => Number(v))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

  await clientQuery(client, `DELETE FROM user_roles WHERE user_id = $1`, [uid]);

  if (ids.length > 0) {
    const by = assignedByUserId != null ? Number(assignedByUserId) : null;
    await clientQuery(
      client,
      `
      INSERT INTO user_roles (user_id, role_id, assigned_by_user_id, assigned_at)
      SELECT $1, r.id, $3, NOW()
      FROM roles r
      WHERE r.id = ANY($2::bigint[])
      ON CONFLICT DO NOTHING
      `,
      [uid, ids, Number.isInteger(by) && by > 0 ? by : null]
    );
  }

  return listRolesForUser(uid, client);
}

async function listStaffUsersWithRoles(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      u.id,
      u.email,
      u.role,
      u.created_at,
      u.updated_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', r.id,
            'slug', r.slug,
            'name', r.name
          )
          ORDER BY r.name
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::json
      ) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.role IN ('admin', 'staff')
       OR EXISTS (SELECT 1 FROM user_roles ur2 WHERE ur2.user_id = u.id)
    GROUP BY u.id
    ORDER BY u.email ASC
    `
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    roles: (row.roles || []).map((r) => ({
      id: String(r.id),
      slug: r.slug,
      name: r.name,
    })),
  }));
}

/**
 * Staff users that have at least one of the given role slugs (for task assignment picker).
 * @param {string[]} roleSlugs
 */
async function listAssignableStaffByRoleSlugs(roleSlugs, client = null) {
  const slugs = (roleSlugs || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (slugs.length === 0) return [];

  const result = await clientQuery(
    client,
    `
    SELECT
      u.id,
      u.email,
      u.role,
      u.created_at,
      u.updated_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', r.id,
            'slug', r.slug,
            'name', r.name
          )
          ORDER BY r.name
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::json
      ) AS roles
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE EXISTS (
      SELECT 1
      FROM user_roles ur2
      JOIN roles r2 ON r2.id = ur2.role_id
      WHERE ur2.user_id = u.id AND r2.slug = ANY($1::text[])
    )
    GROUP BY u.id
    ORDER BY u.email ASC
    `,
    [slugs]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    roles: (row.roles || []).map((r) => ({
      id: String(r.id),
      slug: r.slug,
      name: r.name,
    })),
  }));
}

module.exports = {
  mapUserRole,
  listRolesForUser,
  listRoleSlugsForUser,
  listRoleIdsForUser,
  countUsersWithRoleSlug,
  userHasRoleSlug,
  assignRoleToUser,
  revokeRoleFromUser,
  replaceUserRoles,
  listStaffUsersWithRoles,
  listAssignableStaffByRoleSlugs,
};
