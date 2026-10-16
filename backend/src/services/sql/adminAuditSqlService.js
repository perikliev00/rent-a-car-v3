/**
 * SQL access for the admin_audit_logs table (insert + filtered list).
 */
const { clientQuery } = require('../../db/transaction');

/**
 * Normalize admin user id before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeAdminUserId(value) {
  const id = Number(value);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

/**
 * Normalize actor type before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeActorType(value) {
  if (value === 'system' || value === 'admin' || value === 'customer') {
    return value;
  }
  return 'admin';
}

/**
 * Map a DB/API row into the domain shape used by callers (mapAuditLogRow).
 * @param {object} row
 * @returns {*}
 */
function mapAuditLogRow(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;

  const action = row.action;
  const category = typeof action === 'string' && action.includes('.')
    ? action.split('.')[0]
    : null;

  return {
    id: Number(row.id),
    createdAt: row.created_at,
    action,
    category,
    actorType: row.actor_type,
    adminUser:
      row.admin_user_id != null
        ? {
            id: Number(row.admin_user_id),
            email: row.admin_email || null,
          }
        : null,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata || null,
    ipAddress: row.ip_address != null ? String(row.ip_address) : null,
  };
}

/**
 * Insert an admin audit log row (action + entity required).
 * @param {object} params
 * @param {string|number|null} [params.adminUserId]
 * @param {string} [params.actorType='admin']
 * @param {string} params.action
 * @param {string} params.entityType
 * @param {string|number|null} [params.entityId]
 * @param {object|null} [params.metadata]
 * @param {string|null} [params.ipAddress]
 * @param {object|null} [client]
 * @returns {Promise<{ id: number, created_at: * }>}
 * @throws {Error} when action or entityType is missing
 */
async function insertAuditLog(
  {
    adminUserId = null,
    actorType = 'admin',
    action,
    entityType,
    entityId = null,
    metadata = null,
    ipAddress = null,
  },
  client = null
) {
  if (!action || !entityType) {
    throw new Error('Audit log requires action and entityType');
  }

  const result = await clientQuery(
    client,
    `
    INSERT INTO admin_audit_logs (
      admin_user_id,
      actor_type,
      action,
      entity_type,
      entity_id,
      metadata,
      ip_address
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at
    `,
    [
      normalizeAdminUserId(adminUserId),
      normalizeActorType(actorType),
      action,
      entityType,
      entityId != null ? String(entityId) : null,
      metadata || null,
      ipAddress || null,
    ]
  );

  return result.rows[0];
}

/**
 * Paginated audit log list with optional filters (time, actor, action, entity).
 * @param {object} [params]
 * @param {object|null} [client]
 * @returns {Promise<{ items: object[], page: number, limit: number, total: number }>}
 */
async function listAuditLogs(
  {
    from = null,
    to = null,
    actorType = null,
    actionPrefix = null,
    action = null,
    adminUserId = null,
    entityType = null,
    entityId = null,
    page = 1,
    limit = 50,
  } = {},
  client = null
) {
  // Clamp pagination to keep admin list queries bounded.
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const params = [];

  if (from) {
    params.push(from);
    conditions.push(`a.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`a.created_at <= $${params.length}`);
  }
  if (actorType === 'admin' || actorType === 'system' || actorType === 'customer') {
    params.push(actorType);
    conditions.push(`a.actor_type = $${params.length}`);
  }
  if (action) {
    params.push(action);
    conditions.push(`a.action = $${params.length}`);
  } else if (actionPrefix) {
    params.push(`${actionPrefix}.%`);
    conditions.push(`a.action LIKE $${params.length}`);
  }
  if (adminUserId != null && adminUserId !== '') {
    const normalized = normalizeAdminUserId(adminUserId);
    if (normalized) {
      params.push(normalized);
      conditions.push(`a.admin_user_id = $${params.length}`);
    }
  }
  if (entityType) {
    params.push(entityType);
    conditions.push(`a.entity_type = $${params.length}`);
  }
  if (entityId != null && entityId !== '') {
    params.push(String(entityId));
    conditions.push(`a.entity_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await clientQuery(
    client,
    `
    SELECT COUNT(*)::int AS total
    FROM admin_audit_logs a
    ${whereClause}
    `,
    params
  );

  const listParams = [...params, safeLimit, offset];
  const listResult = await clientQuery(
    client,
    `
    SELECT
      a.id,
      a.admin_user_id,
      a.actor_type,
      a.action,
      a.entity_type,
      a.entity_id,
      a.metadata,
      a.ip_address,
      a.created_at,
      u.email AS admin_email
    FROM admin_audit_logs a
    LEFT JOIN users u ON u.id = a.admin_user_id
    ${whereClause}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    listParams
  );

  return {
    logs: listResult.rows.map(mapAuditLogRow),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: countResult.rows[0]?.total ?? 0,
    },
  };
}

module.exports = {
  insertAuditLog,
  listAuditLogs,
  mapAuditLogRow,
};
