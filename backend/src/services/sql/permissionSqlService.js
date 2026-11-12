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
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the key field value.
    key: row.key,
    // Provide the name field value.
    name: row.name,
    // Provide the description field value.
    description: row.description || null,
    // Provide the category field value.
    category: row.category || null,
    // Provide the created at field value.
    createdAt: row.created_at,
  };
}

/**
 * List permissions from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listPermissions(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
  // Return the resulting value to the caller.
  return result.rows.map(mapPermission);
}

/**
 * Find permission by key via SQL; returns null when missing.
 * @param {string} key
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findPermissionByKey(key, client = null) {
  // Create the normalized constant.
  const normalized = String(key || '').trim();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalized) return null;
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, key, name, description, category, created_at
    FROM permissions
    WHERE key = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalized]
  );
  // Return the resulting value to the caller.
  return mapPermission(result.rows[0]);
}

/**
 * Find permissions by keys via SQL; returns null when missing.
 * @param {Array<*>} keys
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findPermissionsByKeys(keys, client = null) {
  // Create the list constant.
  const list = [...new Set((keys || []).map((k) => String(k || '').trim()).filter(Boolean))];
  // Evaluate the condition and enter the branch when it is true.
  if (list.length === 0) return [];
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, key, name, description, category, created_at
    FROM permissions
    WHERE key = ANY($1::text[])
    `,
    // Contribute this line to the enclosing declaration or statement.
    [list]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapPermission);
}

/**
 * List permission keys for role ids from SQL.
 * @param {Array<*>} roleIds
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listPermissionKeysForRoleIds(roleIds, client = null) {
  // Create the ids constant.
  const ids = (roleIds || [])
    // Call .map to perform this step.
    .map((v) => Number(v))
    // Call .filter to perform this step.
    .filter((id) => Number.isInteger(id) && id > 0);
  // Evaluate the condition and enter the branch when it is true.
  if (ids.length === 0) return [];

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT DISTINCT p.key
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = ANY($1::bigint[])
    ORDER BY p.key ASC
    `,
    // Contribute this line to the enclosing declaration or statement.
    [ids]
  );
  // Return the resulting value to the caller.
  return result.rows.map((r) => r.key);
}

/**
 * List permission keys for role id from SQL.
 * @param {string|number} roleId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listPermissionKeysForRoleId(roleId, client = null) {
  // Return the resulting value to the caller.
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
  // Create the rid constant.
  const rid = Number(roleId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(rid) || rid <= 0) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid role id');
  }

  // Create the ids constant.
  const ids = [...new Set(
    // Continue the surrounding logic with this statement.
    (permissionIds || [])
      // Call .map to perform this step.
      .map((v) => Number(v))
      // Call .filter to perform this step.
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

  // Wait until the asynchronous operation resolves.
  await clientQuery(client, `DELETE FROM role_permissions WHERE role_id = $1`, [rid]);

  // Evaluate the condition and enter the branch when it is true.
  if (ids.length === 0) {
    // Return the resulting value to the caller.
    return [];
  }

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT $1, p.id
    FROM permissions p
    WHERE p.id = ANY($2::bigint[])
    ON CONFLICT DO NOTHING
    `,
    // Contribute this line to the enclosing declaration or statement.
    [rid, ids]
  );

  // Return the resulting value to the caller.
  return listPermissionKeysForRoleId(rid, client);
}

/**
 * List role permission matrix from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listRolePermissionMatrix(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT r.id AS role_id, r.slug AS role_slug, p.id AS permission_id, p.key AS permission_key
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    ORDER BY r.id ASC, p.key ASC NULLS LAST
    `
  );

  // Create the by role constant.
  const byRole = new Map();
  // Iterate using the loop initializer, condition, and step.
  for (const row of result.rows) {
    // Create the role id constant.
    const roleId = String(row.role_id);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!byRole.has(roleId)) {
      // Call byRole.set to perform this step.
      byRole.set(roleId, {
        // Contribute this line to the enclosing declaration or statement.
        roleId,
        // Provide the role slug field value.
        roleSlug: row.role_slug,
        // Provide the permission keys field value.
        permissionKeys: [],
        // Provide the permission ids field value.
        permissionIds: [],
      });
    }
    // Evaluate the condition and enter the branch when it is true.
    if (row.permission_key) {
      // Create the entry constant.
      const entry = byRole.get(roleId);
      // Call entry.permissionKeys.push to perform this step.
      entry.permissionKeys.push(row.permission_key);
      // Call entry.permissionIds.push to perform this step.
      entry.permissionIds.push(String(row.permission_id));
    }
  }
  // Return the resulting value to the caller.
  return [...byRole.values()];
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapPermission,
  // Contribute this line to the enclosing declaration or statement.
  listPermissions,
  // Contribute this line to the enclosing declaration or statement.
  findPermissionByKey,
  // Contribute this line to the enclosing declaration or statement.
  findPermissionsByKeys,
  // Contribute this line to the enclosing declaration or statement.
  listPermissionKeysForRoleIds,
  // Contribute this line to the enclosing declaration or statement.
  listPermissionKeysForRoleId,
  // Contribute this line to the enclosing declaration or statement.
  replaceRolePermissions,
  // Contribute this line to the enclosing declaration or statement.
  listRolePermissionMatrix,
};
