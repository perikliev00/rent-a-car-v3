/**
 * Local filesystem driver for public car images under backend/public/images/uploads.
 * Validates managed URL prefixes to prevent path traversal on delete/read.
 */
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const { reencodeCarImageToFile } = require('./imageProcessing');

// Create the upload temp dir constant.
const UPLOAD_TEMP_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'tmp');
// Create the public car images dir constant.
const PUBLIC_CAR_IMAGES_DIR = path.join(
  // Contribute this line to the enclosing declaration or statement.
  __dirname,
  // Supply the literal value used by the enclosing expression.
  '..',
  // Supply the literal value used by the enclosing expression.
  '..',
  // Supply the literal value used by the enclosing expression.
  'public',
  // Supply the literal value used by the enclosing expression.
  'images',
  // Supply the literal value used by the enclosing expression.
  'uploads'
);
// Create the managed public prefix constant.
const MANAGED_PUBLIC_PREFIX = '/images/uploads/';
// Create the managed filename prefix constant.
const MANAGED_FILENAME_PREFIX = 'car-';

/**
 * generate stored filename.
 * @param {string} originalName
 * @returns {*}
 */
function generateStoredFilename(originalName) {
  // Create the unique constant.
  const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
  // Create the ext constant.
  const ext = path.extname(originalName || '').toLowerCase();
  // Return the resulting value to the caller.
  return `${MANAGED_FILENAME_PREFIX}${unique}${ext}`;
}

/**
 * Transform helper: build public url.
 * @param {string} filename
 * @returns {*}
 */
function buildPublicUrl(filename) {
  // Return the resulting value to the caller.
  return `${MANAGED_PUBLIC_PREFIX}${filename}`;
}

/**
 * Predicate helper: is managed public url.
 * @param {*} publicUrl
 * @returns {*}
 */
function isManagedPublicUrl(publicUrl) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!publicUrl || typeof publicUrl !== 'string') return false;
  // Create the filename constant.
  const filename = path.posix.basename(publicUrl);
  // Return control to the caller with the following value.
  return (
    // Call publicUrl.startsWith to perform this step.
    publicUrl.startsWith(MANAGED_PUBLIC_PREFIX) &&
    // Call filename.startsWith to perform this step.
    filename.startsWith(MANAGED_FILENAME_PREFIX)
  );
}

/**
 * Resolve local path from public url from inputs / Stripe / DB.
 * @param {*} publicUrl
 * @returns {*}
 */
function resolveLocalPathFromPublicUrl(publicUrl) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!isManagedPublicUrl(publicUrl)) return null;
  // Create the filename constant.
  const filename = path.basename(publicUrl);
  // Create the resolved constant.
  const resolved = path.resolve(PUBLIC_CAR_IMAGES_DIR, filename);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!resolved.startsWith(path.resolve(PUBLIC_CAR_IMAGES_DIR))) {
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
  return resolved;
}

/**
 * Ensure temp dir exists or is initialized.
 * @returns {Promise<*>}
 */
async function ensureTempDir() {
  // Wait until the asynchronous operation resolves.
  await fs.promises.mkdir(UPLOAD_TEMP_DIR, { recursive: true });
}

/**
 * Delete by path; returns whether a row was affected.
 * @param {*} filePath
 * @returns {Promise<*>}
 */
async function deleteByPath(filePath) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filePath) return;
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await fs.promises.unlink(filePath);
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Ignore missing files.
  }
}

/**
 * open managed public read stream.
 * @param {*} publicUrl
 * @returns {Promise<*>}
 */
async function openManagedPublicReadStream(publicUrl) {
  // Create the file path constant.
  const filePath = resolveLocalPathFromPublicUrl(publicUrl);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filePath) return null;
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
    // Provide the mime type field value.
    mimeType: 'image/jpeg',
  };
}

/**
 * process uploaded file with domain side effects as documented by callers.
 * @param {object} params
 * @returns {Promise<*>}
 */
async function processUploadedFile({ tempPath, tempFilename }) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!tempPath) {
    // Throw an error to stop the current control flow.
    throw new Error('Missing temp upload path.');
  }

  // Wait until the asynchronous operation resolves.
  await fs.promises.mkdir(PUBLIC_CAR_IMAGES_DIR, { recursive: true });

  // Create the base name constant.
  const baseName = path.basename(tempFilename, path.extname(tempFilename));
  // Create the output filename constant.
  const outputFilename = `${baseName}.jpg`;
  // Create the dest path constant.
  const destPath = path.join(PUBLIC_CAR_IMAGES_DIR, outputFilename);

  // Wait until the asynchronous operation resolves.
  await reencodeCarImageToFile(tempPath, destPath);
  // Wait until the asynchronous operation resolves.
  await deleteByPath(tempPath);

  // Return the resulting value to the caller.
  return {
    // Provide the filename field value.
    filename: outputFilename,
    // Provide the path field value.
    path: destPath,
    // Provide the public url field value.
    publicUrl: buildPublicUrl(outputFilename),
    // Provide the mimetype field value.
    mimetype: 'image/jpeg',
  };
}

/**
 * Delete by public url; returns whether a row was affected.
 * @param {*} publicUrl
 * @returns {Promise<*>}
 */
async function deleteByPublicUrl(publicUrl) {
  // Create the file path constant.
  const filePath = resolveLocalPathFromPublicUrl(publicUrl);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filePath) return false;
  // Wait until the asynchronous operation resolves.
  await deleteByPath(filePath);
  // Return the resulting value to the caller.
  return true;
}

/**
 * List managed public urls from SQL.
 * @returns {Promise<*>}
 */
async function listManagedPublicUrls() {
  // Protected block: isolate failure modes.
  try {
    // Create the entries constant.
    const entries = await fs.promises.readdir(PUBLIC_CAR_IMAGES_DIR, {
      // Provide the with file types field value.
      withFileTypes: true,
    });
    // Return the resulting value to the caller.
    return entries
      // Call .filter to perform this step.
      .filter((entry) => entry.isFile())
      // Call .map to perform this step.
      .map((entry) => entry.name)
      // Call .filter to perform this step.
      .filter((name) => name.startsWith(MANAGED_FILENAME_PREFIX))
      // Call .map to perform this step.
      .map((name) => buildPublicUrl(name));
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'ENOENT') return [];
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * cleanup orphans.
 * @param {*} referencedPublicUrls
 * @returns {Promise<*>}
 */
async function cleanupOrphans(referencedPublicUrls) {
  // Create the referenced constant.
  const referenced = new Set(referencedPublicUrls);
  // Create the managed constant.
  const managed = await listManagedPublicUrls();
  // Create the removed constant.
  const removed = [];

  // Iterate using the loop initializer, condition, and step.
  for (const publicUrl of managed) {
    // Evaluate the condition and enter the branch when it is true.
    if (referenced.has(publicUrl)) continue;
    // Evaluate the condition and enter the branch when it is true.
    if (await deleteByPublicUrl(publicUrl)) {
      // Call removed.push to perform this step.
      removed.push(publicUrl);
    }
  }

  // Return the resulting value to the caller.
  return { removed };
}

/**
 * cleanup stale temp files.
 * @param {*} maxAgeMs
 * @returns {Promise<*>}
 */
async function cleanupStaleTempFiles(maxAgeMs) {
  // Create the removed constant.
  const removed = [];
  // Reserve the entries variable for later assignment.
  let entries;

  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in entries.
    entries = await fs.promises.readdir(UPLOAD_TEMP_DIR, { withFileTypes: true });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'ENOENT') return { removed };
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the cutoff constant.
  const cutoff = Date.now() - maxAgeMs;

  // Iterate using the loop initializer, condition, and step.
  for (const entry of entries) {
    // Guard: early-return or throw when required input is missing/invalid.
    if (!entry.isFile()) continue;
    // Create the file path constant.
    const filePath = path.join(UPLOAD_TEMP_DIR, entry.name);
    // Create the stat constant.
    const stat = await fs.promises.stat(filePath);
    // Evaluate the condition and enter the branch when it is true.
    if (stat.mtimeMs >= cutoff) continue;
    // Wait until the asynchronous operation resolves.
    await deleteByPath(filePath);
    // Call removed.push to perform this step.
    removed.push(filePath);
  }

  // Return the resulting value to the caller.
  return { removed };
}

// Assign the CommonJS module exports.
module.exports = {
  // Provide the driver field value.
  driver: 'local',
  // Contribute this line to the enclosing declaration or statement.
  UPLOAD_TEMP_DIR,
  // Contribute this line to the enclosing declaration or statement.
  PUBLIC_CAR_IMAGES_DIR,
  // Contribute this line to the enclosing declaration or statement.
  MANAGED_PUBLIC_PREFIX,
  // Contribute this line to the enclosing declaration or statement.
  generateStoredFilename,
  // Contribute this line to the enclosing declaration or statement.
  buildPublicUrl,
  // Contribute this line to the enclosing declaration or statement.
  isManagedPublicUrl,
  // Contribute this line to the enclosing declaration or statement.
  ensureTempDir,
  // Contribute this line to the enclosing declaration or statement.
  deleteByPath,
  // Contribute this line to the enclosing declaration or statement.
  processUploadedFile,
  // Contribute this line to the enclosing declaration or statement.
  deleteByPublicUrl,
  // Contribute this line to the enclosing declaration or statement.
  openManagedPublicReadStream,
  // Contribute this line to the enclosing declaration or statement.
  listManagedPublicUrls,
  // Contribute this line to the enclosing declaration or statement.
  cleanupOrphans,
  // Contribute this line to the enclosing declaration or statement.
  cleanupStaleTempFiles,
};
