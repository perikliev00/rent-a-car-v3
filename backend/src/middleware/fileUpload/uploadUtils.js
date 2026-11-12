/**
 * Shared helpers for multer upload temp dirs, magic-byte checks, and promotion to storage.
 */
const fs = require('fs');
const path = require('path');
const storage = require('../../services/storage');

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const TEMP_FILE_QUOTA = 200;

const EXTENSION_TO_MIMETYPES = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
};

/**
 * Ensure the shared upload temp directory exists.
 * Side effects: may create directories via the storage service.
 * @returns {Promise<*>}
 */
async function ensureUploadTempDir() {
  return storage.ensureTempDir();
}

/**
 * Refuse another temp file once the directory already holds the quota.
 * @returns {Promise<void>}
 */
async function assertTempUploadQuota() {
  let entries;
  try {
    entries = await fs.promises.readdir(storage.UPLOAD_TEMP_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  const fileCount = entries.filter((entry) => entry.isFile()).length;
  if (fileCount >= TEMP_FILE_QUOTA) {
    const error = new Error('Upload temporary storage is full');
    error.code = 'TEMP_STORAGE_FULL';
    error.status = 429;
    throw error;
  }
}

/**
 * Delete a multer file from disk/storage by path when present.
 * Side effects: deletes the temp/public file when `file.path` is set.
 * @param {{ path?: string }|null|undefined} file - Multer file descriptor
 * @returns {Promise<void>}
 */
async function removeUploadedFile(file) {
  if (!file?.path) return;
  await storage.deleteByPath(file.path);
}

/**
 * Re-encode and promote a temp upload into durable public storage; mutates `file` in place.
 * Side effects: processes image, updates storage, mutates multer `file` fields.
 * @param {Express.Multer.File} file
 * @returns {Promise<Express.Multer.File>} The same file object with updated path/url fields
 */
async function reencodeAndPromoteUpload(file) {
  if (!file?.path) return file;

  const processed = await storage.processUploadedFile({
    tempPath: file.path,
    tempFilename: file.filename,
  });

  file.filename = processed.filename;
  file.path = processed.path || file.path;
  file.mimetype = processed.mimetype;
  file.publicUrl = processed.publicUrl;
  return file;
}

/**
 * Read the first `length` bytes of a file for magic-byte inspection.
 * @param {string} filePath - Absolute path on disk
 * @param {number} [length=12] - Number of bytes to read from the start
 * @returns {Promise<Buffer>}
 */
async function readFileHead(filePath, length = 12) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

/**
 * Check whether a buffer starts with the magic bytes for the given image extension.
 * @param {Buffer} buffer - File head bytes
 * @param {string} ext - Normalized extension including the leading dot
 * @returns {boolean}
 */
function matchesImageMagic(buffer, ext) {
  if (ext === '.jpg' || ext === '.jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (ext === '.png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (ext === '.webp') {
    return (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

/**
 * Whether the extension is in the public image allow-list.
 * @param {string} ext - Normalized extension including the leading dot
 * @returns {boolean}
 */
function isAllowedImageExtension(ext) {
  return ALLOWED_IMAGE_EXTENSIONS.has(ext);
}

/**
 * Whether declared MIME type matches the extension allow-list entry.
 * @param {string} ext - Normalized extension including the leading dot
 * @param {string} mimetype - Declared Content-Type from the client/multer
 * @returns {boolean}
 */
function isAllowedImageMimetype(ext, mimetype) {
  const allowed = EXTENSION_TO_MIMETYPES[ext];
  return Boolean(allowed && allowed.includes((mimetype || '').toLowerCase()));
}

/**
 * Lowercase path extension including the leading dot.
 * @param {string} originalName - Original filename from the client
 * @returns {string} Lowercased path extension including the leading dot
 */
function getNormalizedExtension(originalName) {
  return path.extname(originalName || '').toLowerCase();
}

module.exports = {
  ALLOWED_IMAGE_EXTENSIONS,
  EXTENSION_TO_MIMETYPES,
  UPLOAD_TEMP_DIR: storage.UPLOAD_TEMP_DIR,
  ensureUploadTempDir,
  assertTempUploadQuota,
  TEMP_FILE_QUOTA,
  removeUploadedFile,
  reencodeAndPromoteUpload,
  readFileHead,
  matchesImageMagic,
  isAllowedImageExtension,
  isAllowedImageMimetype,
  getNormalizedExtension,
};
