/**
 * Drop multer temp files when a request is rejected or the client disconnects
 * before the file is promoted out of the temp directory.
 */
const path = require('path');
// Require the '../../services/storage' module as storage.
const storage = require('../../services/storage');
// Destructure object properties into local variables.
const { removeUploadedFile } = require('./uploadUtils');

/**
 * @param {string|undefined|null} filePath
 * @returns {boolean}
 */
function isTempUploadPath(filePath) {
  // Evaluate the condition and enter the branch when it is true.
  if (!filePath || !storage.UPLOAD_TEMP_DIR) return false;
  // Create the root constant.
  const root = path.resolve(storage.UPLOAD_TEMP_DIR);
  // Create the resolved constant.
  const resolved = path.resolve(filePath);
  // Return the resulting value to the caller.
  return resolved === root || resolved.startsWith(root + path.sep);
}

/**
 * @param {import('express').Request} req
 * @returns {Array<{ path?: string }>}
 */
function collectUploadedFiles(req) {
  // Create the files constant.
  const files = [];
  // Evaluate the condition and enter the branch when it is true.
  if (req.file) files.push(req.file);
  // Evaluate the condition and enter the branch when it is true.
  if (Array.isArray(req.files)) {
    // Call files.push to perform this step.
    files.push(...req.files);
  // Continue the surrounding logic with this statement.
  } else if (req.files && typeof req.files === 'object') {
    // Iterate using the loop initializer, condition, and step.
    for (const list of Object.values(req.files)) {
      // Evaluate the condition and enter the branch when it is true.
      if (Array.isArray(list)) files.push(...list);
    }
  }
  // Return the resulting value to the caller.
  return files;
}

/**
 * @param {import('express').Request} req
 * @returns {Promise<void>}
 */
async function discardTempUploads(req) {
  // Create the files constant.
  const files = collectUploadedFiles(req).filter((file) => isTempUploadPath(file && file.path));
  // Wait until the asynchronous operation resolves.
  await Promise.all(files.map((file) => removeUploadedFile(file)));
}

/**
 * Register cleanup before multer runs so a later 4xx/5xx or aborted body
 * still sees req.file. Successful responses keep files that were moved
 * out of the temp directory.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function releaseTempUploadsOnEarlyExit(req, res, next) {
  // Initialize the mutable released variable.
  let released = false;
  // Create the release constant.
  const release = () => {
    // Evaluate the condition and enter the branch when it is true.
    if (released) return;
    // Update released with the right-hand side value.
    released = true;
    // Call discardTempUploads to perform this step.
    discardTempUploads(req).catch(() => {});
  };

  // Call res.on to perform this step.
  res.on('finish', () => {
    // Evaluate the condition and enter the branch when it is true.
    if (res.statusCode >= 400) release();
  });
  // Call res.on to perform this step.
  res.on('close', () => {
    // Evaluate the condition and enter the branch when it is true.
    if (!res.writableEnded) release();
  });
  // Call next to perform this step.
  next();
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  isTempUploadPath,
  // Contribute this line to the enclosing declaration or statement.
  collectUploadedFiles,
  // Contribute this line to the enclosing declaration or statement.
  discardTempUploads,
  // Contribute this line to the enclosing declaration or statement.
  releaseTempUploadsOnEarlyExit,
};
