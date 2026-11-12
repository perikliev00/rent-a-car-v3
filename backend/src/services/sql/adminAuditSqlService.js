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
  // Create the id constant.
  const id = Number(value);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
  return id;
}

/**
 * Normalize actor type before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeActorType(value) {
  // Evaluate the condition and enter the branch when it is true.
  if (value === 'system' || value === 'admin' || value === 'customer') {
    // Return the resulting value to the caller.
    return value;
  }
  // Return the resulting value to the caller.
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

  // Create the action constant.
  const action = row.action;
  // Create the category constant.
  const category = typeof action === 'string' && action.includes('.')
    // Continue the surrounding logic with this statement.
    ? action.split('.')[0]
    // Contribute this line to the enclosing declaration or statement.
    : null;

  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: Number(row.id),
    // Provide the created at field value.
    createdAt: row.created_at,
    // Contribute this line to the enclosing declaration or statement.
    action,
    // Contribute this line to the enclosing declaration or statement.
    category,
    // Provide the actor type field value.
    actorType: row.actor_type,
    // Provide the admin user field value.
    adminUser:
      // Continue the surrounding logic with this statement.
      row.admin_user_id != null
        // Contribute this line to the enclosing declaration or statement.
        ? {
            // Provide the id field value.
            id: Number(row.admin_user_id),
            // Provide the email field value.
            email: row.admin_email || null,
          }
        // Contribute this line to the enclosing declaration or statement.
        : null,
    // Provide the entity type field value.
    entityType: row.entity_type,
    // Provide the entity id field value.
    entityId: row.entity_id,
    // Provide the metadata field value.
    metadata: row.metadata || null,
    // Provide the ip address field value.
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
    // Update adminUserId with the right-hand side value.
    adminUserId = null,
    // Update actorType with the right-hand side value.
    actorType = 'admin',
    // Contribute this line to the enclosing declaration or statement.
    action,
    // Contribute this line to the enclosing declaration or statement.
    entityType,
    // Update entityId with the right-hand side value.
    entityId = null,
    // Update metadata with the right-hand side value.
    metadata = null,
    // Update ipAddress with the right-hand side value.
    ipAddress = null,
  },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Evaluate the condition and enter the branch when it is true.
  if (!action || !entityType) {
    // Throw an error to stop the current control flow.
    throw new Error('Audit log requires action and entityType');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Call normalizeAdminUserId to perform this step.
      normalizeAdminUserId(adminUserId),
      // Call normalizeActorType to perform this step.
      normalizeActorType(actorType),
      // Contribute this line to the enclosing declaration or statement.
      action,
      // Contribute this line to the enclosing declaration or statement.
      entityType,
      // Continue the surrounding logic with this statement.
      entityId != null ? String(entityId) : null,
      // Contribute this line to the enclosing declaration or statement.
      metadata || null,
      // Contribute this line to the enclosing declaration or statement.
      ipAddress || null,
    ]
  );

  // Return the resulting value to the caller.
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
    // Update from with the right-hand side value.
    from = null,
    // Update to with the right-hand side value.
    to = null,
    // Update actorType with the right-hand side value.
    actorType = null,
    // Update actionPrefix with the right-hand side value.
    actionPrefix = null,
    // Update action with the right-hand side value.
    action = null,
    // Update adminUserId with the right-hand side value.
    adminUserId = null,
    // Update entityType with the right-hand side value.
    entityType = null,
    // Update entityId with the right-hand side value.
    entityId = null,
    // Update page with the right-hand side value.
    page = 1,
    // Update limit with the right-hand side value.
    limit = 50,
  // Continue the surrounding logic with this statement.
  } = {},
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Clamp pagination to keep admin list queries bounded.
  const safePage = Math.max(1, Number(page) || 1);
  // Create the safe limit constant.
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  // Create the offset constant.
  const offset = (safePage - 1) * safeLimit;

  // Create the conditions constant.
  const conditions = [];
  // Create the params constant.
  const params = [];

  // Evaluate the condition and enter the branch when it is true.
  if (from) {
    // Call params.push to perform this step.
    params.push(from);
    // Call conditions.push to perform this step.
    conditions.push(`a.created_at >= $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (to) {
    // Call params.push to perform this step.
    params.push(to);
    // Call conditions.push to perform this step.
    conditions.push(`a.created_at <= $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (actorType === 'admin' || actorType === 'system' || actorType === 'customer') {
    // Call params.push to perform this step.
    params.push(actorType);
    // Call conditions.push to perform this step.
    conditions.push(`a.actor_type = $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (action) {
    // Call params.push to perform this step.
    params.push(action);
    // Call conditions.push to perform this step.
    conditions.push(`a.action = $${params.length}`);
  // Continue the surrounding logic with this statement.
  } else if (actionPrefix) {
    // Call params.push to perform this step.
    params.push(`${actionPrefix}.%`);
    // Call conditions.push to perform this step.
    conditions.push(`a.action LIKE $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (adminUserId != null && adminUserId !== '') {
    // Create the normalized constant.
    const normalized = normalizeAdminUserId(adminUserId);
    // Evaluate the condition and enter the branch when it is true.
    if (normalized) {
      // Call params.push to perform this step.
      params.push(normalized);
      // Call conditions.push to perform this step.
      conditions.push(`a.admin_user_id = $${params.length}`);
    }
  }
  // Evaluate the condition and enter the branch when it is true.
  if (entityType) {
    // Call params.push to perform this step.
    params.push(entityType);
    // Call conditions.push to perform this step.
    conditions.push(`a.entity_type = $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (entityId != null && entityId !== '') {
    // Call params.push to perform this step.
    params.push(String(entityId));
    // Call conditions.push to perform this step.
    conditions.push(`a.entity_id = $${params.length}`);
  }

  // Create the where clause constant.
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Create the count result constant.
  const countResult = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT COUNT(*)::int AS total
    FROM admin_audit_logs a
    ${whereClause}
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );

  // Create the list params constant.
  const listParams = [...params, safeLimit, offset];
  // Create the list result constant.
  const listResult = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Reference the identifier used by the enclosing expression.
    listParams
  );

  // Return the resulting value to the caller.
  return {
    // Provide the logs field value.
    logs: listResult.rows.map(mapAuditLogRow),
    // Provide the pagination field value.
    pagination: {
      // Provide the page field value.
      page: safePage,
      // Provide the limit field value.
      limit: safeLimit,
      // Provide the total field value.
      total: countResult.rows[0]?.total ?? 0,
    },
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  insertAuditLog,
  // Contribute this line to the enclosing declaration or statement.
  listAuditLogs,
  // Contribute this line to the enclosing declaration or statement.
  mapAuditLogRow,
};
