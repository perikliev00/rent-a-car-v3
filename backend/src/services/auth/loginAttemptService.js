/**
 * In-memory login brute-force protection keyed by normalized email.
 * Locks after MAX_ATTEMPTS within LOCKOUT_MS; IPs are hashed in logs only.
 * Process-local (not shared across instances) — suitable for single-node / tests.
 */
const crypto = require('crypto');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');
const metrics = require('../../monitoring/metrics');

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const attempts = new Map();

/**
 * Normalize email before persistence or comparison.
 * @param {string} email
 * @returns {*}
 */
function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

/** Mask email for logs (PII minimization). */
function maskEmail(email) {
  const normalized = normalizeEmail(email);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalized) return '[unknown]';

  const [local, domain] = normalized.split('@');
  // Guard: early-return or throw when required input is missing/invalid.
  if (!domain) {
    return `${normalized.charAt(0)}***`;
  }

  return `${local.charAt(0)}***@${domain}`;
}

/** Short hash of IP for correlation without storing raw addresses. */
function hashIp(ip) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!ip) return undefined;
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 12);
}

/**
 * Get an active attempt record, or null if expired/cleared.
 * @param {string} email
 * @returns {object|null}
 */
function getRecord(email) {
  const key = normalizeEmail(email);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!key) return null;

  const record = attempts.get(key);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!record) return null;

  const now = Date.now();
  // Sliding window: forget failures older than the lockout window.
  if (now - record.firstAttemptAt > LOCKOUT_MS) {
    attempts.delete(key);
    return null;
  }

  // Concurrency / overlap guard (race-sensitive).
  if (record.lockedUntil && record.lockedUntil <= now) {
    attempts.delete(key);
    return null;
  }

  return record;
}

/**
 * Whether the email is currently locked out of login.
 * @param {string} email
 * @returns {boolean}
 */
function isLocked(email) {
  const record = getRecord(email);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!record) return false;
  return record.count >= MAX_ATTEMPTS;
}

/**
 * Record a failed login; lock when threshold reached.
 * @param {string} email
 * @param {{ ip?: string, requestId?: string, correlationId?: string, role?: string }} [meta]
 */
function recordFailure(email, meta = {}) {
  const key = normalizeEmail(email);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!key) return;

  const now = Date.now();
  let record = getRecord(email);

  // Guard: early-return or throw when required input is missing/invalid.
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

/** Clear failures after a successful login. */
function clearAttempts(email) {
  attempts.delete(normalizeEmail(email));
}

/** Test helper to reset the in-memory map. */
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
