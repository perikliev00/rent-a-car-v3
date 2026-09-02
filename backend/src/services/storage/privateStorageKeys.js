const crypto = require('crypto');
const path = require('path');

const KEY_PREFIX = 'private/';

function generatePrivateKey(originalName, category = 'doc') {
  const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  const safeCategory = String(category || 'doc').replace(/[^a-z0-9_-]/gi, '');
  return `${KEY_PREFIX}${safeCategory}/${unique}${ext}`;
}

function isValidPrivateStorageKey(storageKey) {
  if (!storageKey || typeof storageKey !== 'string' || !storageKey.startsWith(KEY_PREFIX)) {
    return false;
  }
  const relative = storageKey.slice(KEY_PREFIX.length);
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
