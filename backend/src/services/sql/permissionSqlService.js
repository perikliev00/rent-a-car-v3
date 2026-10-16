/**
 * SQL for RBAC permissions catalog.
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapPermission).
 * @param {object} row
 * @returns {*}
 */
function mapPermission(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  return {
    id: String(row.id),
    key: row.key,
    name: row.name,
    description: row.description || null,
    category: row.category || null,
    createdAt: row.created_at,
  };
}

/**
 * List permissions from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listPermissions(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT id, key, name, description, category, created_at
    FROM permissions
    ORDER BY
      CASE category
        WHEN 'orders' THEN 0
        WHEN 'ops' THEN 1
        WHEN 'cars' THEN 2
        WHEN 'finance' THEN 3
        WHEN 'users' THEN 4
        WHEN 'settings' THEN 5
        ELSE 99
      END,
      key ASC
    `
  );
  return result.rows.map(mapPermission);
}

/**
 * Find permission by key via SQL; returns null when missing.
 * @param {string} key
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findPermissionByKey(key, client = null) {
  const normalized = String(key || '').trim();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalized) return null;
  const result = await clientQuery(
    client,
    `
    SELECT id, key, name, description, category, created_at
    FROM permissions
    WHERE key = $1
    LIMIT 1
    `,
    [normalized]
  );
  return mapPermission(result.rows[0]);
}

/**
 * Find permissions by keys via SQL; returns null when missing.
 * @param {Array<*>} keys
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findPermissionsByKeys(keys, client = null) {
  const list = [...new Set((keys || []).map((k) => String(k || '').trim()).filter(Boolean))];
  if (list.length === 0) return [];
  const result = await clientQuery(
    client,
    `
    SELECT id, key, name, description, category, created_at
    FROM permissions
    WHERE key = ANY($1::text[])
    `,
    [list]
  );
  return result.rows.map(mapPermission);
}

/**
 * List permission keys for role ids from SQL.
 * @param {Array<*>} roleIds
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listPermissionKeysForRoleIds(roleIds, client = null) {
  const ids = (roleIds || [])
    .map((v) => Number(v))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return [];

  const result = await clientQuery(
    client,
    `
    SELECT DISTINCT p.key
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = ANY($1::bigint[])
    ORDER BY p.key ASC
    `,
    [ids]
  );
  return result.rows.map((r) => r.key);
}

/**
 * List permission keys for role id from SQL.
 * @param {string|number} roleId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listPermissionKeysForRoleId(roleId, client = null) {
  return listPermissionKeysForRoleIds([roleId], client);
}

/**
 * replace role permissions.
 * @param {string|number} roleId
 * @param {Array<*>} permissionIds
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function replaceRolePermissions(roleId, permissionIds, client = null) {
  const rid = Number(roleId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(rid) || rid <= 0) {
    throw new Error('Invalid role id');
  }

  const ids = [...new Set(
    (permissionIds || [])
      .map((v) => Number(v))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

  await clientQuery(client, `DELETE FROM role_permissions WHERE role_id = $1`, [rid]);

  if (ids.length === 0) {
    return [];
  }

  await clientQuery(
    client,
    `
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT $1, p.id
    FROM permissions p
    WHERE p.id = ANY($2::bigint[])
    ON CONFLICT DO NOTHING
    `,
    [rid, ids]
  );

  return listPermissionKeysForRoleId(rid, client);
}

/**
 * List role permission matrix from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listRolePermissionMatrix(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT r.id AS role_id, r.slug AS role_slug, p.id AS permission_id, p.key AS permission_key
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    ORDER BY r.id ASC, p.key ASC NULLS LAST
    `
  );

  const byRole = new Map();
  for (const row of result.rows) {
    const roleId = String(row.role_id);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!byRole.has(roleId)) {
      byRole.set(roleId, {
        roleId,
        roleSlug: row.role_slug,
        permissionKeys: [],
        permissionIds: [],
      });
    }
    if (row.permission_key) {
      const entry = byRole.get(roleId);
      entry.permissionKeys.push(row.permission_key);
      entry.permissionIds.push(String(row.permission_id));
    }
  }
  return [...byRole.values()];
}

module.exports = {
  mapPermission,
  listPermissions,
  findPermissionByKey,
  findPermissionsByKeys,
  listPermissionKeysForRoleIds,
  listPermissionKeysForRoleId,
  replaceRolePermissions,
  listRolePermissionMatrix,
};
