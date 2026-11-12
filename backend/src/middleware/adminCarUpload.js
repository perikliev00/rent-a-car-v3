/**
 * Composed multer middleware chains for admin car image, document, and damage photo uploads.
 * Order: rate limit → multer → multer errors → soft reject → content validation.
 */
const { upload } = require('./upload');
const { adminUploadLimiter } = require('./rateLimit');
const { handleMulterError } = require('./fileUpload/handleMulterError');
const { handleFileRejected } = require('./fileUpload/handleFileRejected');
const {
  validateUploadedImage,
  validateUploadedImages,
} = require('./fileUpload/validateUploadedImage');
const { adminPrivateDocumentUpload } = require('./privateUpload');
const { releaseTempUploadsOnEarlyExit } = require('./fileUpload/cleanupTempUploads');

/** Rate-limited single public image upload for a car listing. */
const adminCarImageUpload = [
  adminUploadLimiter,
  releaseTempUploadsOnEarlyExit,
  upload.single('image'),
  handleMulterError,
  handleFileRejected,
  validateUploadedImage,
];

/** Alias of private document upload stack for car compliance docs. */
const adminCarDocumentUpload = adminPrivateDocumentUpload;

/** Rate-limited multi-photo upload (up to 5) for damage reports. */
const adminCarDamagePhotosUpload = [
  adminUploadLimiter,
  releaseTempUploadsOnEarlyExit,
  upload.array('photos', 5),
  handleMulterError,
  handleFileRejected,
  validateUploadedImages,
];

module.exports = {
  adminCarImageUpload,
  adminCarDocumentUpload,
  adminCarDamagePhotosUpload,
};
