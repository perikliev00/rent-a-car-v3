const adminAuditSql = require('../sql/adminAuditSqlService');
const logger = require('../../utils/logger');
const { getSessionId } = require('../../utils/reservationHelpers');

function getClientIp(req) {
  if (!req) {
    return null;
  }
  return req.ip || req.connection?.remoteAddress || null;
}

function getAdminUserId(req) {
  return req?.session?.user?.id || null;
}

function buildCustomerMetadata(req, metadata = null) {
  const base = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  const userId = req?.session?.user?.id;
  if (userId != null && base.userId == null) {
    base.userId = userId;
  }
  try {
    const sessionId = getSessionId(req);
    if (sessionId && base.sessionId == null) {
      base.sessionId = sessionId;
    }
  } catch {
    // ignore missing session
  }
  return Object.keys(base).length > 0 ? base : null;
}

async function logAuditEvent(payload, client = null) {
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

async function logAdminAction(req, payload, client = null) {
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

async function logSystemAction(payload, client = null) {
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

async function logCustomerAction(req, payload, client = null) {
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
