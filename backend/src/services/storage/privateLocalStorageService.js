/**
 * Local private file store under uploads/private (customer documents, etc.).
 * Keys must pass isValidPrivateStorageKey; resolve rejects traversal outside PRIVATE_DIR.
 */
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const { KEY_PREFIX, generatePrivateKey, isValidPrivateStorageKey } = require('./privateStorageKeys');

// Create the private dir constant.
const PRIVATE_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'private');

/**
 * Map a storage key to an absolute path under PRIVATE_DIR, or null if invalid.
 * @param {string} storageKey
 * @returns {string|null}
 */
function resolvePrivatePath(storageKey) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!isValidPrivateStorageKey(storageKey)) {
    // Return the resulting value to the caller.
    return null;
  }
  // Create the relative constant.
  const relative = storageKey.slice(KEY_PREFIX.length);
  // Create the resolved constant.
  const resolved = path.resolve(PRIVATE_DIR, relative);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!resolved.startsWith(path.resolve(PRIVATE_DIR))) {
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
  return resolved;
}

/**
 * Ensure private dir exists or is initialized.
 * @returns {Promise<*>}
 */
async function ensurePrivateDir() {
  // Wait until the asynchronous operation resolves.
  await fs.promises.mkdir(PRIVATE_DIR, { recursive: true });
}

/**
 * Move a multer temp file into private storage (handles cross-device EXDEV).
 * @returns {Promise<{ storageKey: string, path: string, mimeType: string, sizeBytes: number }>}
 */
async function storePrivateFile({ tempPath, originalName, category = 'doc', mimeType }) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!tempPath) {
    // Throw an error to stop the current control flow.
    throw new Error('Missing temp upload path.');
  }

  // Create the storage key constant.
  const storageKey = generatePrivateKey(originalName, category);
  // Create the dest path constant.
  const destPath = resolvePrivatePath(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!destPath) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid private storage key.');
  }

  // Wait until the asynchronous operation resolves.
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  // Wait until the asynchronous operation resolves.
  await fs.promises.rename(tempPath, destPath).catch(async (err) => {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'EXDEV') {
      // Wait until the asynchronous operation resolves.
      await fs.promises.copyFile(tempPath, destPath);
      // Wait until the asynchronous operation resolves.
      await fs.promises.unlink(tempPath);
      // Return control to the caller with the following value.
      return;
    }
    // Throw an error to stop the current control flow.
    throw err;
  });

  // Create the stat constant.
  const stat = await fs.promises.stat(destPath);
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    storageKey,
    // Provide the path field value.
    path: destPath,
    // Provide the mime type field value.
    mimeType: mimeType || 'application/octet-stream',
    // Provide the size bytes field value.
    sizeBytes: stat.size,
  };
}

/**
 * store private buffer.
 * @param {object} params
 * @returns {Promise<*>}
 */
async function storePrivateBuffer({ buffer, originalName, category = 'doc', mimeType }) {
  // Create the storage key constant.
  const storageKey = generatePrivateKey(originalName, category);
  // Create the dest path constant.
  const destPath = resolvePrivatePath(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!destPath) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid private storage key.');
  }

  // Wait until the asynchronous operation resolves.
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  // Wait until the asynchronous operation resolves.
  await fs.promises.writeFile(destPath, buffer);

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    storageKey,
    // Provide the path field value.
    path: destPath,
    // Provide the mime type field value.
    mimeType: mimeType || 'application/octet-stream',
    // Provide the size bytes field value.
    sizeBytes: buffer.length,
  };
}

/**
 * open private read stream.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function openPrivateReadStream(storageKey) {
  // Create the file path constant.
  const filePath = resolvePrivatePath(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filePath) {
    // Return the resulting value to the caller.
    return null;
  }
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await fs.promises.access(filePath, fs.constants.R_OK);
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
  return {
    // Provide the stream field value.
    stream: fs.createReadStream(filePath),
    // Provide the path field value.
    path: filePath,
  };
}

/**
 * Delete private file; returns whether a row was affected.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function deletePrivateFile(storageKey) {
  // Create the file path constant.
  const filePath = resolvePrivatePath(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filePath) return false;
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await fs.promises.unlink(filePath);
    // Return the resulting value to the caller.
    return true;
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'ENOENT') return false;
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * private file exists.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function privateFileExists(storageKey) {
  // Create the file path constant.
  const filePath = resolvePrivatePath(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filePath) return false;
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await fs.promises.access(filePath, fs.constants.R_OK);
    // Return the resulting value to the caller.
    return true;
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return false;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Provide the driver field value.
  driver: 'local',
  // Contribute this line to the enclosing declaration or statement.
  PRIVATE_DIR,
  // Contribute this line to the enclosing declaration or statement.
  KEY_PREFIX,
  // Contribute this line to the enclosing declaration or statement.
  generatePrivateKey,
  // Contribute this line to the enclosing declaration or statement.
  resolvePrivatePath,
  // Contribute this line to the enclosing declaration or statement.
  ensurePrivateDir,
  // Contribute this line to the enclosing declaration or statement.
  storePrivateFile,
  // Contribute this line to the enclosing declaration or statement.
  storePrivateBuffer,
  // Contribute this line to the enclosing declaration or statement.
  openPrivateReadStream,
  // Contribute this line to the enclosing declaration or statement.
  deletePrivateFile,
  // Contribute this line to the enclosing declaration or statement.
  privateFileExists,
};
