const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PRIVATE_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'private');
const KEY_PREFIX = 'private/';

function generatePrivateKey(originalName, category = 'doc') {
  const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  const safeCategory = String(category || 'doc').replace(/[^a-z0-9_-]/gi, '');
  return `${KEY_PREFIX}${safeCategory}/${unique}${ext}`;
}

function resolvePrivatePath(storageKey) {
  if (!storageKey || typeof storageKey !== 'string' || !storageKey.startsWith(KEY_PREFIX)) {
    return null;
  }
  const relative = storageKey.slice(KEY_PREFIX.length);
  if (relative.includes('..') || path.isAbsolute(relative)) {
    return null;
  }
  const resolved = path.resolve(PRIVATE_DIR, relative);
  if (!resolved.startsWith(path.resolve(PRIVATE_DIR))) {
    return null;
  }
  return resolved;
}

async function ensurePrivateDir() {
  await fs.promises.mkdir(PRIVATE_DIR, { recursive: true });
}

async function storePrivateFile({ tempPath, originalName, category = 'doc', mimeType }) {
  if (!tempPath) {
    throw new Error('Missing temp upload path.');
  }

  const storageKey = generatePrivateKey(originalName, category);
  const destPath = resolvePrivatePath(storageKey);
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

async function storePrivateBuffer({ buffer, originalName, category = 'doc', mimeType }) {
  const storageKey = generatePrivateKey(originalName, category);
  const destPath = resolvePrivatePath(storageKey);
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

async function openPrivateReadStream(storageKey) {
  const filePath = resolvePrivatePath(storageKey);
  if (!filePath) {
    return null;
  }
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

async function deletePrivateFile(storageKey) {
  const filePath = resolvePrivatePath(storageKey);
  if (!filePath) return false;
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

async function privateFileExists(storageKey) {
  const filePath = resolvePrivatePath(storageKey);
  if (!filePath) return false;
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
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
