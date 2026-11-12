/**
 * SQL for RBAC roles (find by ids, list).
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Map a DB/API row into the domain shape used by callers (mapRole).
 * @param {object} row
 * @returns {*}
 */
function mapRole(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the slug field value.
    slug: row.slug,
    // Provide the name field value.
    name: row.name,
    // Provide the description field value.
    description: row.description || null,
    // Provide the is system field value.
    isSystem: Boolean(row.is_system),
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
  };
}

/**
 * List roles from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listRoles(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, slug, name, description, is_system, created_at, updated_at
    FROM roles
    ORDER BY
      CASE slug
        WHEN 'owner' THEN 0
        WHEN 'manager' THEN 1
        WHEN 'receptionist' THEN 2
        WHEN 'accountant' THEN 3
        WHEN 'support' THEN 4
        WHEN 'driver' THEN 5
        WHEN 'cleaner' THEN 6
        ELSE 99
      END,
      name ASC
    `
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapRole);
}

/**
 * Find role by id via SQL; returns null when missing.
 * @param {string|number} roleId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findRoleById(roleId, client = null) {
  // Create the id constant.
  const id = Number(roleId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) return null;
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, slug, name, description, is_system, created_at, updated_at
    FROM roles
    WHERE id = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Return the resulting value to the caller.
  return mapRole(result.rows[0]);
}

/**
 * Find role by slug via SQL; returns null when missing.
 * @param {string} slug
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findRoleBySlug(slug, client = null) {
  // Create the normalized constant.
  const normalized = String(slug || '').trim().toLowerCase();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalized) return null;
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, slug, name, description, is_system, created_at, updated_at
    FROM roles
    WHERE slug = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalized]
  );
  // Return the resulting value to the caller.
  return mapRole(result.rows[0]);
}

/**
 * Find roles by ids via SQL; returns null when missing.
 * @param {Array<*>} roleIds
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findRolesByIds(roleIds, client = null) {
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
    SELECT id, slug, name, description, is_system, created_at, updated_at
    FROM roles
    WHERE id = ANY($1::bigint[])
    `,
    // Contribute this line to the enclosing declaration or statement.
    [ids]
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapRole);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapRole,
  // Contribute this line to the enclosing declaration or statement.
  listRoles,
  // Contribute this line to the enclosing declaration or statement.
  findRoleById,
  // Contribute this line to the enclosing declaration or statement.
  findRoleBySlug,
  // Contribute this line to the enclosing declaration or statement.
  findRolesByIds,
};
