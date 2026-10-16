/**
 * Local private file store under uploads/private (customer documents, etc.).
 * Keys must pass isValidPrivateStorageKey; resolve rejects traversal outside PRIVATE_DIR.
 */
const fs = require('fs');
const path = require('path');
const { KEY_PREFIX, generatePrivateKey, isValidPrivateStorageKey } = require('./privateStorageKeys');

const PRIVATE_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'private');

/**
 * Map a storage key to an absolute path under PRIVATE_DIR, or null if invalid.
 * @param {string} storageKey
 * @returns {string|null}
 */
function resolvePrivatePath(storageKey) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!isValidPrivateStorageKey(storageKey)) {
    return null;
  }
  const relative = storageKey.slice(KEY_PREFIX.length);
  const resolved = path.resolve(PRIVATE_DIR, relative);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!resolved.startsWith(path.resolve(PRIVATE_DIR))) {
    return null;
  }
  return resolved;
}

/**
 * Ensure private dir exists or is initialized.
 * @returns {Promise<*>}
 */
async function ensurePrivateDir() {
  await fs.promises.mkdir(PRIVATE_DIR, { recursive: true });
}

/**
 * Move a multer temp file into private storage (handles cross-device EXDEV).
 * @returns {Promise<{ storageKey: string, path: string, mimeType: string, sizeBytes: number }>}
 */
async function storePrivateFile({ tempPath, originalName, category = 'doc', mimeType }) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!tempPath) {
    throw new Error('Missing temp upload path.');
  }

  const storageKey = generatePrivateKey(originalName, category);
  const destPath = resolvePrivatePath(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!destPath) {
    throw new Error('Invalid private storage key.');
  }

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await fs.promises.rename(tempPath, destPath).catch(async (err) => {
    if (err.code === 'EXDEV') {
      await fs.promises.copyFile(tempPath, destPath);
      await fs.promises.unlink(tempPath);
      return;
    }
    throw err;
  });

  const stat = await fs.promises.stat(destPath);
  return {
    storageKey,
    path: destPath,
    mimeType: mimeType || 'application/octet-stream',
    sizeBytes: stat.size,
  };
}

/**
 * store private buffer.
 * @param {object} params
 * @returns {Promise<*>}
 */
async function storePrivateBuffer({ buffer, originalName, category = 'doc', mimeType }) {
  const storageKey = generatePrivateKey(originalName, category);
  const destPath = resolvePrivatePath(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!destPath) {
    throw new Error('Invalid private storage key.');
  }

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await fs.promises.writeFile(destPath, buffer);

  return {
    storageKey,
    path: destPath,
    mimeType: mimeType || 'application/octet-stream',
    sizeBytes: buffer.length,
  };
}

/**
 * open private read stream.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function openPrivateReadStream(storageKey) {
  const filePath = resolvePrivatePath(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filePath) {
    return null;
  }
  // Protected block: isolate failure modes.
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    return null;
  }
  return {
    stream: fs.createReadStream(filePath),
    path: filePath,
  };
}

/**
 * Delete private file; returns whether a row was affected.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function deletePrivateFile(storageKey) {
  const filePath = resolvePrivatePath(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filePath) return false;
  // Protected block: isolate failure modes.
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * private file exists.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function privateFileExists(storageKey) {
  const filePath = resolvePrivatePath(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filePath) return false;
  // Protected block: isolate failure modes.
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  driver: 'local',
  PRIVATE_DIR,
  KEY_PREFIX,
  generatePrivateKey,
  resolvePrivatePath,
  ensurePrivateDir,
  storePrivateFile,
  storePrivateBuffer,
  openPrivateReadStream,
  deletePrivateFile,
  privateFileExists,
};
