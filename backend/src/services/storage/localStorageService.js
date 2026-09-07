const fs = require('fs');
const path = require('path');
const { reencodeCarImageToFile } = require('./imageProcessing');

const UPLOAD_TEMP_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'tmp');
const PUBLIC_CAR_IMAGES_DIR = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'images',
  'uploads'
);
const MANAGED_PUBLIC_PREFIX = '/images/uploads/';
const MANAGED_FILENAME_PREFIX = 'car-';

function generateStoredFilename(originalName) {
  const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName || '').toLowerCase();
  return `${MANAGED_FILENAME_PREFIX}${unique}${ext}`;
}

function buildPublicUrl(filename) {
  return `${MANAGED_PUBLIC_PREFIX}${filename}`;
}

function isManagedPublicUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return false;
  const filename = path.posix.basename(publicUrl);
  return (
    publicUrl.startsWith(MANAGED_PUBLIC_PREFIX) &&
    filename.startsWith(MANAGED_FILENAME_PREFIX)
  );
}

function resolveLocalPathFromPublicUrl(publicUrl) {
  if (!isManagedPublicUrl(publicUrl)) return null;
  const filename = path.basename(publicUrl);
  const resolved = path.resolve(PUBLIC_CAR_IMAGES_DIR, filename);
  if (!resolved.startsWith(path.resolve(PUBLIC_CAR_IMAGES_DIR))) {
    return null;
  }
  return resolved;
}

async function ensureTempDir() {
  await fs.promises.mkdir(UPLOAD_TEMP_DIR, { recursive: true });
}

async function deleteByPath(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Ignore missing files.
  }
}

async function openManagedPublicReadStream(publicUrl) {
  const filePath = resolveLocalPathFromPublicUrl(publicUrl);
  if (!filePath) return null;
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    return null;
  }
  return {
    stream: fs.createReadStream(filePath),
    mimeType: 'image/jpeg',
  };
}

async function processUploadedFile({ tempPath, tempFilename }) {
  if (!tempPath) {
    throw new Error('Missing temp upload path.');
  }

  await fs.promises.mkdir(PUBLIC_CAR_IMAGES_DIR, { recursive: true });

  const baseName = path.basename(tempFilename, path.extname(tempFilename));
  const outputFilename = `${baseName}.jpg`;
  const destPath = path.join(PUBLIC_CAR_IMAGES_DIR, outputFilename);

  await reencodeCarImageToFile(tempPath, destPath);
  await deleteByPath(tempPath);

  return {
    filename: outputFilename,
    path: destPath,
    publicUrl: buildPublicUrl(outputFilename),
    mimetype: 'image/jpeg',
  };
}

async function deleteByPublicUrl(publicUrl) {
  const filePath = resolveLocalPathFromPublicUrl(publicUrl);
  if (!filePath) return false;
  await deleteByPath(filePath);
  return true;
}

async function listManagedPublicUrls() {
  try {
    const entries = await fs.promises.readdir(PUBLIC_CAR_IMAGES_DIR, {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(MANAGED_FILENAME_PREFIX))
      .map((name) => buildPublicUrl(name));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function cleanupOrphans(referencedPublicUrls) {
  const referenced = new Set(referencedPublicUrls);
  const managed = await listManagedPublicUrls();
  const removed = [];

  for (const publicUrl of managed) {
    if (referenced.has(publicUrl)) continue;
    if (await deleteByPublicUrl(publicUrl)) {
      removed.push(publicUrl);
    }
  }

  return { removed };
}

async function cleanupStaleTempFiles(maxAgeMs) {
  const removed = [];
  let entries;

  try {
    entries = await fs.promises.readdir(UPLOAD_TEMP_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return { removed };
    throw err;
  }

  const cutoff = Date.now() - maxAgeMs;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(UPLOAD_TEMP_DIR, entry.name);
    const stat = await fs.promises.stat(filePath);
    if (stat.mtimeMs >= cutoff) continue;
    await deleteByPath(filePath);
    removed.push(filePath);
  }

  return { removed };
}

module.exports = {
  driver: 'local',
  UPLOAD_TEMP_DIR,
  PUBLIC_CAR_IMAGES_DIR,
  MANAGED_PUBLIC_PREFIX,
  generateStoredFilename,
  buildPublicUrl,
  isManagedPublicUrl,
  ensureTempDir,
  deleteByPath,
  processUploadedFile,
  deleteByPublicUrl,
  openManagedPublicReadStream,
  listManagedPublicUrls,
  cleanupOrphans,
  cleanupStaleTempFiles,
};
