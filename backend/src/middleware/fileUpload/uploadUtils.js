/**
 * Shared helpers for multer upload temp dirs, magic-byte checks, and promotion to storage.
 */
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Require the '../../services/storage' module as storage.
const storage = require('../../services/storage');

// Create the allowed image extensions constant.
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
// Create the temp file quota constant.
const TEMP_FILE_QUOTA = 200;

// Create the extension to mimetypes constant.
const EXTENSION_TO_MIMETYPES = {
  // Supply the literal value used by the enclosing expression.
  '.jpg': ['image/jpeg'],
  // Supply the literal value used by the enclosing expression.
  '.jpeg': ['image/jpeg'],
  // Supply the literal value used by the enclosing expression.
  '.png': ['image/png'],
  // Supply the literal value used by the enclosing expression.
  '.webp': ['image/webp'],
};

/**
 * Ensure the shared upload temp directory exists.
 * Side effects: may create directories via the storage service.
 * @returns {Promise<*>}
 */
async function ensureUploadTempDir() {
  // Return the resulting value to the caller.
  return storage.ensureTempDir();
}

/**
 * Refuse another temp file once the directory already holds the quota.
 * @returns {Promise<void>}
 */
async function assertTempUploadQuota() {
  // Reserve the entries variable for later assignment.
  let entries;
  // Start a try block for operations that may fail.
  try {
    // Store the awaited result in entries.
    entries = await fs.promises.readdir(storage.UPLOAD_TEMP_DIR, { withFileTypes: true });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'ENOENT') return;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Create the file count constant.
  const fileCount = entries.filter((entry) => entry.isFile()).length;
  // Evaluate the condition and enter the branch when it is true.
  if (fileCount >= TEMP_FILE_QUOTA) {
    // Create the error constant.
    const error = new Error('Upload temporary storage is full');
    // Update error.code with the right-hand side value.
    error.code = 'TEMP_STORAGE_FULL';
    // Update error.status with the right-hand side value.
    error.status = 429;
    // Throw an error to stop the current control flow.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!file?.path) return;
  // Wait until the asynchronous operation resolves.
  await storage.deleteByPath(file.path);
}

/**
 * Re-encode and promote a temp upload into durable public storage; mutates `file` in place.
 * Side effects: processes image, updates storage, mutates multer `file` fields.
 * @param {Express.Multer.File} file
 * @returns {Promise<Express.Multer.File>} The same file object with updated path/url fields
 */
async function reencodeAndPromoteUpload(file) {
  // Evaluate the condition and enter the branch when it is true.
  if (!file?.path) return file;

  // Create the processed constant.
  const processed = await storage.processUploadedFile({
    // Provide the temp path field value.
    tempPath: file.path,
    // Provide the temp filename field value.
    tempFilename: file.filename,
  });

  // Update file.filename with the right-hand side value.
  file.filename = processed.filename;
  // Update file.path with the right-hand side value.
  file.path = processed.path || file.path;
  // Update file.mimetype with the right-hand side value.
  file.mimetype = processed.mimetype;
  // Update file.publicUrl with the right-hand side value.
  file.publicUrl = processed.publicUrl;
  // Return the resulting value to the caller.
  return file;
}

/**
 * Read the first `length` bytes of a file for magic-byte inspection.
 * @param {string} filePath - Absolute path on disk
 * @param {number} [length=12] - Number of bytes to read from the start
 * @returns {Promise<Buffer>}
 */
async function readFileHead(filePath, length = 12) {
  // Create the handle constant.
  const handle = await fs.promises.open(filePath, 'r');
  // Start a try block for operations that may fail.
  try {
    // Create the buffer constant.
    const buffer = Buffer.alloc(length);
    // Wait until the asynchronous operation resolves.
    await handle.read(buffer, 0, length, 0);
    // Return the resulting value to the caller.
    return buffer;
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Wait until the asynchronous operation resolves.
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
  // Evaluate the condition and enter the branch when it is true.
  if (ext === '.jpg' || ext === '.jpeg') {
    // Return the resulting value to the caller.
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (ext === '.png') {
    // Return control to the caller with the following value.
    return (
      // Update buffer[0] with the right-hand side value.
      buffer[0] === 0x89 &&
      // Update buffer[1] with the right-hand side value.
      buffer[1] === 0x50 &&
      // Update buffer[2] with the right-hand side value.
      buffer[2] === 0x4e &&
      // Update buffer[3] with the right-hand side value.
      buffer[3] === 0x47
    );
  }
  // Evaluate the condition and enter the branch when it is true.
  if (ext === '.webp') {
    // Return control to the caller with the following value.
    return (
      // Call buffer.toString to perform this step.
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      // Call buffer.toString to perform this step.
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  // Return the resulting value to the caller.
  return false;
}

/**
 * Whether the extension is in the public image allow-list.
 * @param {string} ext - Normalized extension including the leading dot
 * @returns {boolean}
 */
function isAllowedImageExtension(ext) {
  // Return the resulting value to the caller.
  return ALLOWED_IMAGE_EXTENSIONS.has(ext);
}

/**
 * Whether declared MIME type matches the extension allow-list entry.
 * @param {string} ext - Normalized extension including the leading dot
 * @param {string} mimetype - Declared Content-Type from the client/multer
 * @returns {boolean}
 */
function isAllowedImageMimetype(ext, mimetype) {
  // Create the allowed constant.
  const allowed = EXTENSION_TO_MIMETYPES[ext];
  // Return the resulting value to the caller.
  return Boolean(allowed && allowed.includes((mimetype || '').toLowerCase()));
}

/**
 * Lowercase path extension including the leading dot.
 * @param {string} originalName - Original filename from the client
 * @returns {string} Lowercased path extension including the leading dot
 */
function getNormalizedExtension(originalName) {
  // Return the resulting value to the caller.
  return path.extname(originalName || '').toLowerCase();
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_IMAGE_EXTENSIONS,
  // Contribute this line to the enclosing declaration or statement.
  EXTENSION_TO_MIMETYPES,
  // Provide the upload temp dir field value.
  UPLOAD_TEMP_DIR: storage.UPLOAD_TEMP_DIR,
  // Contribute this line to the enclosing declaration or statement.
  ensureUploadTempDir,
  // Contribute this line to the enclosing declaration or statement.
  assertTempUploadQuota,
  // Contribute this line to the enclosing declaration or statement.
  TEMP_FILE_QUOTA,
  // Contribute this line to the enclosing declaration or statement.
  removeUploadedFile,
  // Contribute this line to the enclosing declaration or statement.
  reencodeAndPromoteUpload,
  // Contribute this line to the enclosing declaration or statement.
  readFileHead,
  // Contribute this line to the enclosing declaration or statement.
  matchesImageMagic,
  // Contribute this line to the enclosing declaration or statement.
  isAllowedImageExtension,
  // Contribute this line to the enclosing declaration or statement.
  isAllowedImageMimetype,
  // Contribute this line to the enclosing declaration or statement.
  getNormalizedExtension,
};
