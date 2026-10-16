/**
 * Admin audit trail helpers. Failures are logged but never thrown so a
 * failed insert cannot roll back the business operation that triggered it.
 */
const adminAuditSql = require('../sql/adminAuditSqlService');
const logger = require('../../utils/logger');
const { getSessionId } = require('../../utils/reservationHelpers');

/** @param {import('express').Request|null|undefined} req */
function getClientIp(req) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!req) {
    return null;
  }
  return req.ip || req.connection?.remoteAddress || null;
}

/** @param {import('express').Request|null|undefined} req */
function getAdminUserId(req) {
  return req?.session?.user?.id || null;
}

/**
 * Enrich customer audit metadata with session/user ids when present.
 * Missing session is ignored so anonymous flows still audit.
 * @param {import('express').Request|null|undefined} req
 * @param {object|null} [metadata]
 */
function buildCustomerMetadata(req, metadata = null) {
  const base = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  const userId = req?.session?.user?.id;
  // Guard: early-return or throw when required input is missing/invalid.
  if (userId != null && base.userId == null) {
    base.userId = userId;
  }
  // Protected block: isolate failure modes.
  try {
    const sessionId = getSessionId(req);
    // Guard: early-return or throw when required input is missing/invalid.
    if (sessionId && base.sessionId == null) {
      base.sessionId = sessionId;
    }
  } catch {
    // ignore missing session
  }
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
    const {
      actorType = 'admin',
      actorId = null,
      action,
      entityType,
      entityId = null,
      metadata = null,
      ipAddress = null,
    } = payload || {};

    // Only persist adminUserId for admin actors; system/customer leave it null.
    await adminAuditSql.insertAuditLog(
      {
        adminUserId: actorType === 'admin' ? actorId : null,
        actorType,
        action,
        entityType,
        entityId,
        metadata,
        ipAddress,
      },
      client
    );
  } catch (err) {
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
    await adminAuditSql.insertAuditLog(
      {
        adminUserId: getAdminUserId(req),
        actorType: 'admin',
        ipAddress: getClientIp(req),
        ...payload,
      },
      client
    );
  } catch (err) {
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
    await adminAuditSql.insertAuditLog(
      {
        adminUserId: null,
        actorType: 'system',
        ...payload,
      },
      client
    );
  } catch (err) {
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
    const { metadata, ...rest } = payload || {};
    await adminAuditSql.insertAuditLog(
      {
        adminUserId: null,
        actorType: 'customer',
        ipAddress: getClientIp(req),
        ...rest,
        metadata: buildCustomerMetadata(req, metadata),
      },
      client
    );
  } catch (err) {
    logger.error({ err, context: 'logCustomerAction' }, 'Customer audit log failed');
  }
}

/** @param {object} [filters] @param {object|null} [client] */
async function listAuditLogs(filters = {}, client = null) {
  return adminAuditSql.listAuditLogs(filters, client);
}

module.exports = {
  logAuditEvent,
  logAdminAction,
  logSystemAction,
  logCustomerAction,
  listAuditLogs,
  getAdminUserId,
};
