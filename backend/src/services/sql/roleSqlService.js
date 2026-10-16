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
  return {
    id: String(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description || null,
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List roles from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listRoles(client = null) {
  const result = await clientQuery(
    client,
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
  return result.rows.map(mapRole);
}

/**
 * Find role by id via SQL; returns null when missing.
 * @param {string|number} roleId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findRoleById(roleId, client = null) {
  const id = Number(roleId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) return null;
  const result = await clientQuery(
    client,
    `
    SELECT id, slug, name, description, is_system, created_at, updated_at
    FROM roles
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
  return mapRole(result.rows[0]);
}

/**
 * Find role by slug via SQL; returns null when missing.
 * @param {string} slug
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findRoleBySlug(slug, client = null) {
  const normalized = String(slug || '').trim().toLowerCase();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalized) return null;
  const result = await clientQuery(
    client,
    `
    SELECT id, slug, name, description, is_system, created_at, updated_at
    FROM roles
    WHERE slug = $1
    LIMIT 1
    `,
    [normalized]
  );
  return mapRole(result.rows[0]);
}

/**
 * Find roles by ids via SQL; returns null when missing.
 * @param {Array<*>} roleIds
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findRolesByIds(roleIds, client = null) {
  const ids = (roleIds || [])
    .map((v) => Number(v))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return [];
  const result = await clientQuery(
    client,
    `
    SELECT id, slug, name, description, is_system, created_at, updated_at
    FROM roles
    WHERE id = ANY($1::bigint[])
    `,
    [ids]
  );
  return result.rows.map(mapRole);
}

module.exports = {
  mapRole,
  listRoles,
  findRoleById,
  findRoleBySlug,
  findRolesByIds,
};
