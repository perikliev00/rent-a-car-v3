const crypto = require('crypto');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');
const metrics = require('../../monitoring/metrics');

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const attempts = new Map();

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function maskEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return '[unknown]';

  const [local, domain] = normalized.split('@');
  if (!domain) {
    return `${normalized.charAt(0)}***`;
  }

  return `${local.charAt(0)}***@${domain}`;
}

function hashIp(ip) {
  if (!ip) return undefined;
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 12);
}

function getRecord(email) {
  const key = normalizeEmail(email);
  if (!key) return null;

  const record = attempts.get(key);
  if (!record) return null;

  const now = Date.now();
  if (now - record.firstAttemptAt > LOCKOUT_MS) {
    attempts.delete(key);
    return null;
  }

  if (record.lockedUntil && record.lockedUntil <= now) {
    attempts.delete(key);
    return null;
  }

  return record;
}

function isLocked(email) {
  const record = getRecord(email);
  if (!record) return false;
  return record.count >= MAX_ATTEMPTS;
}

function recordFailure(email, meta = {}) {
  const key = normalizeEmail(email);
  if (!key) return;

  const now = Date.now();
  let record = getRecord(email);

  if (!record) {
    record = { count: 0, firstAttemptAt: now, lockedUntil: null };
  }

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
  }

  attempts.set(key, record);

  const payload = {
    event: 'login_failed',
    emailMasked: maskEmail(key),
    ipHash: hashIp(meta.ip),
    requestId: meta.requestId || meta.correlationId,
    attemptCount: record.count,
    locked: Boolean(record.lockedUntil),
  };

  logger.warn(payload, 'Failed login attempt');

  if (meta.role === 'admin') {
    logEvent.warn('admin.login.failed', payload);
    metrics.incrementAdminLoginFailures();
  }
}

function clearAttempts(email) {
  attempts.delete(normalizeEmail(email));
}

function resetForTests() {
  attempts.clear();
}

module.exports = {
  MAX_ATTEMPTS,
  isLocked,
  recordFailure,
  clearAttempts,
  resetForTests,
};
