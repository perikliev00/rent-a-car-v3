/**
 * Multer disk upload for public image files (5MB max) into the temp upload directory.
 * Soft-rejects bad types via `req.fileRejected` so later middleware can return 422.
 */
const multer = require('multer');
const fileStorage = require('../services/storage');
const {
  ensureUploadTempDir,
  assertTempUploadQuota,
  getNormalizedExtension,
  isAllowedImageExtension,
  isAllowedImageMimetype,
} = require('./fileUpload/uploadUtils');

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure temp dir exists before multer writes the stream.
    ensureUploadTempDir()
      .then(() => assertTempUploadQuota())
      .then(() => cb(null, fileStorage.UPLOAD_TEMP_DIR))
      .catch((err) => cb(err));
  },
  filename: function (req, file, cb) {
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
  const ext = getNormalizedExtension(file.originalname);
  if (!isAllowedImageExtension(ext)) {
    req.fileRejected = true;
    return cb(null, false);
  }
  if (!isAllowedImageMimetype(ext, file.mimetype)) {
    req.fileRejected = true;
    return cb(null, false);
  }
  cb(null, true);
}

/** Configured multer instance for single/array image uploads. */
const upload = multer({ storage: diskStorage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { upload };
