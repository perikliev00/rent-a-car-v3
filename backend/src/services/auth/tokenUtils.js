const crypto = require('crypto');

const TOKEN_BYTES = 32;
const TOKEN_HASH_LENGTH = 64;

/**
 * Raw single-use security token. Only ever returned to the caller so it can be mailed —
 * never persisted, logged, or included in audit metadata.
 */
function generateRawToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/** SHA-256 hex digest, matching the api_keys storage convention. */
function hashToken(rawToken) {
  const value = String(rawToken || '');
  if (!value) {
    return null;
  }
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length || left.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

/**
 * Rejects malformed input before it reaches the database, so a garbage token can never
 * be mistaken for a lookup miss on a valid one.
 */
function isPlausibleRawToken(rawToken) {
  return /^[0-9a-f]{64}$/i.test(String(rawToken || ''));
}

module.exports = {
  TOKEN_BYTES,
  TOKEN_HASH_LENGTH,
  generateRawToken,
  hashToken,
  safeEqual,
  isPlausibleRawToken,
};
