/**
 * Admin audit trail helpers. Failures are logged but never thrown so a
 * failed insert cannot roll back the business operation that triggered it.
 */
const adminAuditSql = require('../sql/adminAuditSqlService');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Destructure object properties into local variables.
const { getSessionId } = require('../../utils/reservationHelpers');

/** @param {import('express').Request|null|undefined} req */
function getClientIp(req) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!req) {
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
  return req.ip || req.connection?.remoteAddress || null;
}

/** @param {import('express').Request|null|undefined} req */
function getAdminUserId(req) {
  // Return the resulting value to the caller.
  return req?.session?.user?.id || null;
}

/**
 * Enrich customer audit metadata with session/user ids when present.
 * Missing session is ignored so anonymous flows still audit.
 * @param {import('express').Request|null|undefined} req
 * @param {object|null} [metadata]
 */
function buildCustomerMetadata(req, metadata = null) {
  // Create the base constant.
  const base = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  // Create the user id constant.
  const userId = req?.session?.user?.id;
  // Guard: early-return or throw when required input is missing/invalid.
  if (userId != null && base.userId == null) {
    // Update base.userId with the right-hand side value.
    base.userId = userId;
  }
  // Protected block: isolate failure modes.
  try {
    // Create the session id constant.
    const sessionId = getSessionId(req);
    // Guard: early-return or throw when required input is missing/invalid.
    if (sessionId && base.sessionId == null) {
      // Update base.sessionId with the right-hand side value.
      base.sessionId = sessionId;
    }
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // ignore missing session
  }
  // Return the resulting value to the caller.
  return Object.keys(base).length > 0 ? base : null;
}

/**
 * Generic audit insert; swallows errors so callers stay best-effort.
 * @param {object} payload
 * @param {object|null} [client] Optional PG client for transactional audits
 */
async function logAuditEvent(payload, client = null) {
  // Protected block: isolate failure modes.
  try {
    // Destructure object properties into local variables.
    const {
      // Update actorType with the right-hand side value.
      actorType = 'admin',
      // Update actorId with the right-hand side value.
      actorId = null,
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
    // Continue the surrounding logic with this statement.
    } = payload || {};

    // Only persist adminUserId for admin actors; system/customer leave it null.
    await adminAuditSql.insertAuditLog(
      {
        // Provide the admin user id field value.
        adminUserId: actorType === 'admin' ? actorId : null,
        // Contribute this line to the enclosing declaration or statement.
        actorType,
        // Contribute this line to the enclosing declaration or statement.
        action,
        // Contribute this line to the enclosing declaration or statement.
        entityType,
        // Contribute this line to the enclosing declaration or statement.
        entityId,
        // Contribute this line to the enclosing declaration or statement.
        metadata,
        // Contribute this line to the enclosing declaration or statement.
        ipAddress,
      },
      // Reference the identifier used by the enclosing expression.
      client
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'logAuditEvent' }, 'Audit log failed');
  }
}

/**
 * Audit an admin action from the Express request (user id + IP).
 * @param {import('express').Request} req
 * @param {object} payload
 * @param {object|null} [client]
 */
async function logAdminAction(req, payload, client = null) {
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await adminAuditSql.insertAuditLog(
      {
        // Provide the admin user id field value.
        adminUserId: getAdminUserId(req),
        // Provide the actor type field value.
        actorType: 'admin',
        // Provide the ip address field value.
        ipAddress: getClientIp(req),
        // Spread payload into the surrounding structure.
        ...payload,
      },
      // Reference the identifier used by the enclosing expression.
      client
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'logAdminAction' }, 'Admin audit log failed');
  }
}

/**
 * Audit a system/background action (no admin user id).
 * @param {object} payload
 * @param {object|null} [client]
 */
async function logSystemAction(payload, client = null) {
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await adminAuditSql.insertAuditLog(
      {
        // Provide the admin user id field value.
        adminUserId: null,
        // Provide the actor type field value.
        actorType: 'system',
        // Spread payload into the surrounding structure.
        ...payload,
      },
      // Reference the identifier used by the enclosing expression.
      client
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'logSystemAction' }, 'System audit log failed');
  }
}

/**
 * Audit a customer-facing action with enriched session metadata.
 * @param {import('express').Request} req
 * @param {object} payload
 * @param {object|null} [client]
 */
async function logCustomerAction(req, payload, client = null) {
  // Protected block: isolate failure modes.
  try {
    // Destructure object properties into local variables.
    const { metadata, ...rest } = payload || {};
    // Wait until the asynchronous operation resolves.
    await adminAuditSql.insertAuditLog(
      {
        // Provide the admin user id field value.
        adminUserId: null,
        // Provide the actor type field value.
        actorType: 'customer',
        // Provide the ip address field value.
        ipAddress: getClientIp(req),
        // Spread rest into the surrounding structure.
        ...rest,
        // Provide the metadata field value.
        metadata: buildCustomerMetadata(req, metadata),
      },
      // Reference the identifier used by the enclosing expression.
      client
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'logCustomerAction' }, 'Customer audit log failed');
  }
}

/** @param {object} [filters] @param {object|null} [client] */
async function listAuditLogs(filters = {}, client = null) {
  // Return the resulting value to the caller.
  return adminAuditSql.listAuditLogs(filters, client);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  logAuditEvent,
  // Contribute this line to the enclosing declaration or statement.
  logAdminAction,
  // Contribute this line to the enclosing declaration or statement.
  logSystemAction,
  // Contribute this line to the enclosing declaration or statement.
  logCustomerAction,
  // Contribute this line to the enclosing declaration or statement.
  listAuditLogs,
  // Contribute this line to the enclosing declaration or statement.
  getAdminUserId,
};
