/**
 * SQL for user↔role assignments and staff user listing with roles.
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapUserRole).
 * @param {object} row
 * @returns {*}
 */
function mapUserRole(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the user id field value.
    userId: String(row.user_id),
    // Provide the role id field value.
    roleId: String(row.role_id),
    // Provide the role slug field value.
    roleSlug: row.role_slug || null,
    // Provide the role name field value.
    roleName: row.role_name || null,
    // Provide the assigned by user id field value.
    assignedByUserId: row.assigned_by_user_id != null ? String(row.assigned_by_user_id) : null,
    // Provide the assigned at field value.
    assignedAt: row.assigned_at,
  };
}

/**
 * List roles for user from SQL.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listRolesForUser(userId, client = null) {
  // Create the uid constant.
  const uid = Number(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(uid) || uid <= 0) return [];

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [uid]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapUserRole);
}

/**
 * List role slugs for user from SQL.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listRoleSlugsForUser(userId, client = null) {
  // Create the roles constant.
  const roles = await listRolesForUser(userId, client);
  // Return the resulting value to the caller.
  return roles.map((r) => r.roleSlug).filter(Boolean);
}

/**
 * List role ids for user from SQL.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listRoleIdsForUser(userId, client = null) {
  // Create the roles constant.
  const roles = await listRolesForUser(userId, client);
  // Return the resulting value to the caller.
  return roles.map((r) => Number(r.roleId));
}

/**
 * count users with role slug.
 * @param {string} slug
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function countUsersWithRoleSlug(slug, client = null) {
  // Create the normalized constant.
  const normalized = String(slug || '').trim().toLowerCase();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalized) return 0;
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT COUNT(*)::int AS count
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.slug = $1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalized]
  );
  // Return the resulting value to the caller.
  return result.rows[0]?.count || 0;
}

/**
 * user has role slug.
 * @param {string|number} userId
 * @param {string} slug
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function userHasRoleSlug(userId, slug, client = null) {
  // Create the uid constant.
  const uid = Number(userId);
  // Create the normalized constant.
  const normalized = String(slug || '').trim().toLowerCase();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(uid) || uid <= 0 || !normalized) return false;

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = $1 AND r.slug = $2
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [uid, normalized]
  );
  // Return the resulting value to the caller.
  return result.rows.length > 0;
}

/**
 * assign role to user.
 * @param {string|number} userId
 * @param {string|number} roleId
 * @param {string|number} [assignedByUserId]
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function assignRoleToUser(userId, roleId, assignedByUserId = null, client = null) {
  // Create the uid constant.
  const uid = Number(userId);
  // Create the rid constant.
  const rid = Number(roleId);
  // Create the by constant.
  const by = assignedByUserId != null ? Number(assignedByUserId) : null;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(rid) || rid <= 0) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid user or role id');
  }

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO user_roles (user_id, role_id, assigned_by_user_id, assigned_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    // Continue the surrounding logic with this statement.
    [uid, rid, Number.isInteger(by) && by > 0 ? by : null]
  );

  // Return the resulting value to the caller.
  return listRolesForUser(uid, client);
}

/**
 * revoke role from user.
 * @param {string|number} userId
 * @param {string|number} roleId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function revokeRoleFromUser(userId, roleId, client = null) {
  // Create the uid constant.
  const uid = Number(userId);
  // Create the rid constant.
  const rid = Number(roleId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(rid) || rid <= 0) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid user or role id');
  }

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM user_roles
    WHERE user_id = $1 AND role_id = $2
    `,
    // Contribute this line to the enclosing declaration or statement.
    [uid, rid]
  );

  // Return the resulting value to the caller.
  return listRolesForUser(uid, client);
}

/**
 * replace user roles.
 * @param {string|number} userId
 * @param {Array<*>} roleIds
 * @param {string|number} [assignedByUserId]
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function replaceUserRoles(userId, roleIds, assignedByUserId = null, client = null) {
  // Create the uid constant.
  const uid = Number(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(uid) || uid <= 0) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid user id');
  }

  // Create the ids constant.
  const ids = [...new Set(
    // Continue the surrounding logic with this statement.
    (roleIds || [])
      // Call .map to perform this step.
      .map((v) => Number(v))
      // Call .filter to perform this step.
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

  // Wait until the asynchronous operation resolves.
  await clientQuery(client, `DELETE FROM user_roles WHERE user_id = $1`, [uid]);

  // Evaluate the condition and enter the branch when it is true.
  if (ids.length > 0) {
    // Create the by constant.
    const by = assignedByUserId != null ? Number(assignedByUserId) : null;
    // Wait until the asynchronous operation resolves.
    await clientQuery(
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO user_roles (user_id, role_id, assigned_by_user_id, assigned_at)
      SELECT $1, r.id, $3, NOW()
      FROM roles r
      WHERE r.id = ANY($2::bigint[])
      ON CONFLICT DO NOTHING
      `,
      // Continue the surrounding logic with this statement.
      [uid, ids, Number.isInteger(by) && by > 0 ? by : null]
    );
  }

  // Return the resulting value to the caller.
  return listRolesForUser(uid, client);
}

/**
 * List staff users with roles from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listStaffUsersWithRoles(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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

  // Return the resulting value to the caller.
  return result.rows.map((row) => ({
    // Provide the id field value.
    id: String(row.id),
    // Provide the email field value.
    email: row.email,
    // Provide the role field value.
    role: row.role,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
    // Provide the roles field value.
    roles: (row.roles || []).map((r) => ({
      // Provide the id field value.
      id: String(r.id),
      // Provide the slug field value.
      slug: r.slug,
      // Provide the name field value.
      name: r.name,
    })),
  }));
}

/**
 * Staff users that have at least one of the given role slugs (for task assignment picker).
 * @param {string[]} roleSlugs
 */
async function listAssignableStaffByRoleSlugs(roleSlugs, client = null) {
  // Create the slugs constant.
  const slugs = (roleSlugs || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  // Evaluate the condition and enter the branch when it is true.
  if (slugs.length === 0) return [];

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [slugs]
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => ({
    // Provide the id field value.
    id: String(row.id),
    // Provide the email field value.
    email: row.email,
    // Provide the role field value.
    role: row.role,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
    // Provide the roles field value.
    roles: (row.roles || []).map((r) => ({
      // Provide the id field value.
      id: String(r.id),
      // Provide the slug field value.
      slug: r.slug,
      // Provide the name field value.
      name: r.name,
    })),
  }));
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapUserRole,
  // Contribute this line to the enclosing declaration or statement.
  listRolesForUser,
  // Contribute this line to the enclosing declaration or statement.
  listRoleSlugsForUser,
  // Contribute this line to the enclosing declaration or statement.
  listRoleIdsForUser,
  // Contribute this line to the enclosing declaration or statement.
  countUsersWithRoleSlug,
  // Contribute this line to the enclosing declaration or statement.
  userHasRoleSlug,
  // Contribute this line to the enclosing declaration or statement.
  assignRoleToUser,
  // Contribute this line to the enclosing declaration or statement.
  revokeRoleFromUser,
  // Contribute this line to the enclosing declaration or statement.
  replaceUserRoles,
  // Contribute this line to the enclosing declaration or statement.
  listStaffUsersWithRoles,
  // Contribute this line to the enclosing declaration or statement.
  listAssignableStaffByRoleSlugs,
};
