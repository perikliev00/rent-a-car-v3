/**
 * Drop multer temp files when a request is rejected or the client disconnects
 * before the file is promoted out of the temp directory.
 */
const path = require('path');
const storage = require('../../services/storage');
const { removeUploadedFile } = require('./uploadUtils');

/**
 * @param {string|undefined|null} filePath
 * @returns {boolean}
 */
function isTempUploadPath(filePath) {
  if (!filePath || !storage.UPLOAD_TEMP_DIR) return false;
  const root = path.resolve(storage.UPLOAD_TEMP_DIR);
  const resolved = path.resolve(filePath);
  return resolved === root || resolved.startsWith(root + path.sep);
}

/**
 * @param {import('express').Request} req
 * @returns {Array<{ path?: string }>}
 */
function collectUploadedFiles(req) {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else if (req.files && typeof req.files === 'object') {
    for (const list of Object.values(req.files)) {
      if (Array.isArray(list)) files.push(...list);
    }
  }
  return files;
}

/**
 * @param {import('express').Request} req
 * @returns {Promise<void>}
 */
async function discardTempUploads(req) {
  const files = collectUploadedFiles(req).filter((file) => isTempUploadPath(file && file.path));
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
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    discardTempUploads(req).catch(() => {});
  };

  res.on('finish', () => {
    if (res.statusCode >= 400) release();
  });
  res.on('close', () => {
    if (!res.writableEnded) release();
  });
  next();
}

module.exports = {
  isTempUploadPath,
  collectUploadedFiles,
  discardTempUploads,
  releaseTempUploadsOnEarlyExit,
};
