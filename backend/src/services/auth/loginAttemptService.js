/**
 * In-memory login brute-force protection keyed by normalized email.
 * Locks after MAX_ATTEMPTS within LOCKOUT_MS; IPs are hashed in logs only.
 * Process-local (not shared across instances) — suitable for single-node / tests.
 */
const crypto = require('crypto');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Require the '../../monitoring/logEvent' module as logEvent.
const logEvent = require('../../monitoring/logEvent');
// Require the '../../monitoring/metrics' module as metrics.
const metrics = require('../../monitoring/metrics');

// Create the max attempts constant.
const MAX_ATTEMPTS = 5;
// Create the lockout ms constant.
const LOCKOUT_MS = 15 * 60 * 1000;

// Create the attempts constant.
const attempts = new Map();

/**
 * Normalize email before persistence or comparison.
 * @param {string} email
 * @returns {*}
 */
function normalizeEmail(email) {
  // Return the resulting value to the caller.
  return (email || '').trim().toLowerCase();
}

/** Mask email for logs (PII minimization). */
function maskEmail(email) {
  // Create the normalized constant.
  const normalized = normalizeEmail(email);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalized) return '[unknown]';

  // Destructure array values into local variables.
  const [local, domain] = normalized.split('@');
  // Guard: early-return or throw when required input is missing/invalid.
  if (!domain) {
    // Return the resulting value to the caller.
    return `${normalized.charAt(0)}***`;
  }

  // Return the resulting value to the caller.
  return `${local.charAt(0)}***@${domain}`;
}

/** Short hash of IP for correlation without storing raw addresses. */
function hashIp(ip) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!ip) return undefined;
  // Return the resulting value to the caller.
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 12);
}

/**
 * Get an active attempt record, or null if expired/cleared.
 * @param {string} email
 * @returns {object|null}
 */
function getRecord(email) {
  // Create the key constant.
  const key = normalizeEmail(email);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!key) return null;

  // Create the record constant.
  const record = attempts.get(key);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!record) return null;

  // Create the now constant.
  const now = Date.now();
  // Sliding window: forget failures older than the lockout window.
  if (now - record.firstAttemptAt > LOCKOUT_MS) {
    // Call attempts.delete to perform this step.
    attempts.delete(key);
    // Return the resulting value to the caller.
    return null;
  }

  // Concurrency / overlap guard (race-sensitive).
  if (record.lockedUntil && record.lockedUntil <= now) {
    // Call attempts.delete to perform this step.
    attempts.delete(key);
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return record;
}

/**
 * Whether the email is currently locked out of login.
 * @param {string} email
 * @returns {boolean}
 */
function isLocked(email) {
  // Create the record constant.
  const record = getRecord(email);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!record) return false;
  // Return the resulting value to the caller.
  return record.count >= MAX_ATTEMPTS;
}

/**
 * Record a failed login; lock when threshold reached.
 * @param {string} email
 * @param {{ ip?: string, requestId?: string, correlationId?: string, role?: string }} [meta]
 */
function recordFailure(email, meta = {}) {
  // Create the key constant.
  const key = normalizeEmail(email);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!key) return;

  // Create the now constant.
  const now = Date.now();
  // Initialize the mutable record variable.
  let record = getRecord(email);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!record) {
    // Update record with the right-hand side value.
    record = { count: 0, firstAttemptAt: now, lockedUntil: null };
  }

  // Update record.count with the right-hand side value.
  record.count += 1;

  // Evaluate the condition and enter the branch when it is true.
  if (record.count >= MAX_ATTEMPTS) {
    // Update record.lockedUntil with the right-hand side value.
    record.lockedUntil = now + LOCKOUT_MS;
  }

  // Call attempts.set to perform this step.
  attempts.set(key, record);

  // Create the payload constant.
  const payload = {
    // Provide the event field value.
    event: 'login_failed',
    // Provide the email masked field value.
    emailMasked: maskEmail(key),
    // Provide the ip hash field value.
    ipHash: hashIp(meta.ip),
    // Provide the request id field value.
    requestId: meta.requestId || meta.correlationId,
    // Provide the attempt count field value.
    attemptCount: record.count,
    // Provide the locked field value.
    locked: Boolean(record.lockedUntil),
  };

  // Call logger.warn to perform this step.
  logger.warn(payload, 'Failed login attempt');

  // Evaluate the condition and enter the branch when it is true.
  if (meta.role === 'admin') {
    // Call logEvent.warn to perform this step.
    logEvent.warn('admin.login.failed', payload);
    // Call metrics.incrementAdminLoginFailures to perform this step.
    metrics.incrementAdminLoginFailures();
  }
}

/** Clear failures after a successful login. */
function clearAttempts(email) {
  // Call attempts.delete to perform this step.
  attempts.delete(normalizeEmail(email));
}

/** Test helper to reset the in-memory map. */
function resetForTests() {
  // Call attempts.clear to perform this step.
  attempts.clear();
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  MAX_ATTEMPTS,
  // Contribute this line to the enclosing declaration or statement.
  isLocked,
  // Contribute this line to the enclosing declaration or statement.
  recordFailure,
  // Contribute this line to the enclosing declaration or statement.
  clearAttempts,
  // Contribute this line to the enclosing declaration or statement.
  resetForTests,
};
