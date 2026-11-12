/**
 * Composed multer middleware chains for admin car image, document, and damage photo uploads.
 * Order: rate limit → multer → multer errors → soft reject → content validation.
 */
const { upload } = require('./upload');
// Destructure object properties into local variables.
const { adminUploadLimiter } = require('./rateLimit');
// Destructure object properties into local variables.
const { handleMulterError } = require('./fileUpload/handleMulterError');
// Destructure object properties into local variables.
const { handleFileRejected } = require('./fileUpload/handleFileRejected');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  validateUploadedImage,
  // Contribute this line to the enclosing declaration or statement.
  validateUploadedImages,
// Continue the surrounding logic with this statement.
} = require('./fileUpload/validateUploadedImage');
// Destructure object properties into local variables.
const { adminPrivateDocumentUpload } = require('./privateUpload');
// Destructure object properties into local variables.
const { releaseTempUploadsOnEarlyExit } = require('./fileUpload/cleanupTempUploads');

/** Rate-limited single public image upload for a car listing. */
const adminCarImageUpload = [
  // Contribute this line to the enclosing declaration or statement.
  adminUploadLimiter,
  // Contribute this line to the enclosing declaration or statement.
  releaseTempUploadsOnEarlyExit,
  // Call upload.single to perform this step.
  upload.single('image'),
  // Contribute this line to the enclosing declaration or statement.
  handleMulterError,
  // Contribute this line to the enclosing declaration or statement.
  handleFileRejected,
  // Contribute this line to the enclosing declaration or statement.
  validateUploadedImage,
];

/** Alias of private document upload stack for car compliance docs. */
const adminCarDocumentUpload = adminPrivateDocumentUpload;

/** Rate-limited multi-photo upload (up to 5) for damage reports. */
const adminCarDamagePhotosUpload = [
  // Contribute this line to the enclosing declaration or statement.
  adminUploadLimiter,
  // Contribute this line to the enclosing declaration or statement.
  releaseTempUploadsOnEarlyExit,
  // Call upload.array to perform this step.
  upload.array('photos', 5),
  // Contribute this line to the enclosing declaration or statement.
  handleMulterError,
  // Contribute this line to the enclosing declaration or statement.
  handleFileRejected,
  // Contribute this line to the enclosing declaration or statement.
  validateUploadedImages,
];

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  adminCarImageUpload,
  // Contribute this line to the enclosing declaration or statement.
  adminCarDocumentUpload,
  // Contribute this line to the enclosing declaration or statement.
  adminCarDamagePhotosUpload,
};
