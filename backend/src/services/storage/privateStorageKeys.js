/**
 * Private storage key helpers: generate opaque keys under `private/` and
 * reject path traversal / absolute paths before resolving on disk or S3.
 */
const crypto = require('crypto');
// Require the 'path' module as path.
const path = require('path');

// Create the key prefix constant.
const KEY_PREFIX = 'private/';

/**
 * @param {string} originalName - Used only for file extension
 * @param {string} [category='doc']
 * @returns {string} storage key e.g. private/customer-docs/<unique>.jpg
 */
function generatePrivateKey(originalName, category = 'doc') {
  // Create the unique constant.
  const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  // Create the ext constant.
  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  // Create the safe category constant.
  const safeCategory = String(category || 'doc').replace(/[^a-z0-9_-]/gi, '');
  // Return the resulting value to the caller.
  return `${KEY_PREFIX}${safeCategory}/${unique}${ext}`;
}

/**
 * @param {string} storageKey
 * @returns {boolean}
 */
function isValidPrivateStorageKey(storageKey) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!storageKey || typeof storageKey !== 'string' || !storageKey.startsWith(KEY_PREFIX)) {
    // Return the resulting value to the caller.
    return false;
  }
  // Create the relative constant.
  const relative = storageKey.slice(KEY_PREFIX.length);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!relative || relative.includes('..') || path.posix.isAbsolute(relative) || path.win32.isAbsolute(relative)) {
    // Return the resulting value to the caller.
    return false;
  }
  // Return the resulting value to the caller.
  return true;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  KEY_PREFIX,
  // Contribute this line to the enclosing declaration or statement.
  generatePrivateKey,
  // Contribute this line to the enclosing declaration or statement.
  isValidPrivateStorageKey,
};
