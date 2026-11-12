/**
 * Multer disk upload for public image files (5MB max) into the temp upload directory.
 * Soft-rejects bad types via `req.fileRejected` so later middleware can return 422.
 */
const multer = require('multer');
// Require the '../services/storage' module as fileStorage.
const fileStorage = require('../services/storage');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  ensureUploadTempDir,
  // Contribute this line to the enclosing declaration or statement.
  assertTempUploadQuota,
  // Contribute this line to the enclosing declaration or statement.
  getNormalizedExtension,
  // Contribute this line to the enclosing declaration or statement.
  isAllowedImageExtension,
  // Contribute this line to the enclosing declaration or statement.
  isAllowedImageMimetype,
// Continue the surrounding logic with this statement.
} = require('./fileUpload/uploadUtils');

// Create the disk storage constant.
const diskStorage = multer.diskStorage({
  // Provide the destination field value.
  destination: function (req, file, cb) {
    // Ensure temp dir exists before multer writes the stream.
    ensureUploadTempDir()
      // Call .then to perform this step.
      .then(() => assertTempUploadQuota())
      // Call .then to perform this step.
      .then(() => cb(null, fileStorage.UPLOAD_TEMP_DIR))
      // Call .catch to perform this step.
      .catch((err) => cb(err));
  },
  // Provide the filename field value.
  filename: function (req, file, cb) {
    // Call cb to perform this step.
    cb(null, fileStorage.generateStoredFilename(file.originalname));
  },
});

/**
 * Accept only allowed image extensions/MIME types; soft-reject via `req.fileRejected`.
 * Side effects: may set `req.fileRejected` when rejecting without throwing.
 * @param {import('express').Request} req
 * @param {Express.Multer.File} file
 * @param {multer.FileFilterCallback} cb
 * @returns {void}
 */
function fileFilter(req, file, cb) {
  // Create the ext constant.
  const ext = getNormalizedExtension(file.originalname);
  // Evaluate the condition and enter the branch when it is true.
  if (!isAllowedImageExtension(ext)) {
    // Update req.fileRejected with the right-hand side value.
    req.fileRejected = true;
    // Return the resulting value to the caller.
    return cb(null, false);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (!isAllowedImageMimetype(ext, file.mimetype)) {
    // Update req.fileRejected with the right-hand side value.
    req.fileRejected = true;
    // Return the resulting value to the caller.
    return cb(null, false);
  }
  // Call cb to perform this step.
  cb(null, true);
}

/** Configured multer instance for single/array image uploads. */
const upload = multer({ storage: diskStorage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Assign the CommonJS module exports.
module.exports = { upload };
