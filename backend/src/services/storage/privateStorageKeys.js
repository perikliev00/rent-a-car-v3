/**
 * Private storage key helpers: generate opaque keys under `private/` and
 * reject path traversal / absolute paths before resolving on disk or S3.
 */
const crypto = require('crypto');
const path = require('path');

const KEY_PREFIX = 'private/';

/**
 * @param {string} originalName - Used only for file extension
 * @param {string} [category='doc']
 * @returns {string} storage key e.g. private/customer-docs/<unique>.jpg
 */
function generatePrivateKey(originalName, category = 'doc') {
  const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  const safeCategory = String(category || 'doc').replace(/[^a-z0-9_-]/gi, '');
  return `${KEY_PREFIX}${safeCategory}/${unique}${ext}`;
}

/**
 * @param {string} storageKey
 * @returns {boolean}
 */
function isValidPrivateStorageKey(storageKey) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!storageKey || typeof storageKey !== 'string' || !storageKey.startsWith(KEY_PREFIX)) {
    return false;
  }
  const relative = storageKey.slice(KEY_PREFIX.length);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!relative || relative.includes('..') || path.posix.isAbsolute(relative) || path.win32.isAbsolute(relative)) {
    return false;
  }
  return true;
}

module.exports = {
  KEY_PREFIX,
  generatePrivateKey,
  isValidPrivateStorageKey,
};
