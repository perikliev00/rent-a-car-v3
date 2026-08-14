const multer = require('multer');
const fileStorage = require('../services/storage');
const {
  ensureUploadTempDir,
  getNormalizedExtension,
  isAllowedImageExtension,
  isAllowedImageMimetype,
} = require('./fileUpload/uploadUtils');

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    ensureUploadTempDir()
      .then(() => cb(null, fileStorage.UPLOAD_TEMP_DIR))
      .catch((err) => cb(err));
  },
  filename: function (req, file, cb) {
    cb(null, fileStorage.generateStoredFilename(file.originalname));
  },
});

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

const upload = multer({ storage: diskStorage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { upload };
