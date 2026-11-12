/**
 * Private document/image multer stacks with magic-byte validation for account and admin uploads.
 * Soft failures set `req.fileValidationError`; chains end with a 422 converter.
 */
const path = require('path');
// Require the 'multer' module as multer.
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
  removeUploadedFile,
  // Contribute this line to the enclosing declaration or statement.
  readFileHead,
// Continue the surrounding logic with this statement.
} = require('./fileUpload/uploadUtils');
// Destructure object properties into local variables.
const { releaseTempUploadsOnEarlyExit } = require('./fileUpload/cleanupTempUploads');
// Destructure object properties into local variables.
const { handleMulterError } = require('./fileUpload/handleMulterError');
// Destructure object properties into local variables.
const { handleFileRejected } = require('./fileUpload/handleFileRejected');
// Destructure object properties into local variables.
const { adminUploadLimiter, accountUploadLimiter } = require('./rateLimit');
// Require the '../utils/apiResponse' module as apiResponse.
const apiResponse = require('../utils/apiResponse');

// Create the allowed doc extensions constant.
const ALLOWED_DOC_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.pdf']);
// Create the allowed image extensions constant.
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// Create the doc extension to mimetypes constant.
const DOC_EXTENSION_TO_MIMETYPES = {
  // Supply the literal value used by the enclosing expression.
  '.jpg': ['image/jpeg'],
  // Supply the literal value used by the enclosing expression.
  '.jpeg': ['image/jpeg'],
  // Supply the literal value used by the enclosing expression.
  '.png': ['image/png'],
  // Supply the literal value used by the enclosing expression.
  '.webp': ['image/webp'],
  // Supply the literal value used by the enclosing expression.
  '.pdf': ['application/pdf'],
};

/**
 * Detect PDF magic header (`%PDF-`).
 * @param {Buffer} buffer - File head bytes
 * @returns {boolean}
 */
function matchesPdfMagic(buffer) {
  // Return the resulting value to the caller.
  return buffer && buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-';
}

/**
 * Detect image magic bytes for jpg/png/webp.
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

// Create the disk storage constant.
const diskStorage = multer.diskStorage({
  // Provide the destination field value.
  destination: function (req, file, cb) {
    // Call ensureUploadTempDir to perform this step.
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
 * Build a multer fileFilter that soft-rejects disallowed extensions/MIME types.
 * Side effects: may set `req.fileRejected` and `req.fileRejectedMessage`.
 * @param {Set<string>} allowedExtensions - Allowed lowercase extensions with dots
 * @param {string} rejectedMessage - Message stored when soft-rejecting
 * @returns {multer.Options['fileFilter']}
 */
function createFileFilter(allowedExtensions, rejectedMessage) {
  // Return the resulting value to the caller.
  return function fileFilter(req, file, cb) {
    // Create the ext constant.
    const ext = getNormalizedExtension(file.originalname);
    // Evaluate the condition and enter the branch when it is true.
    if (!allowedExtensions.has(ext)) {
      // Update req.fileRejected with the right-hand side value.
      req.fileRejected = true;
      // Update req.fileRejectedMessage with the right-hand side value.
      req.fileRejectedMessage = rejectedMessage;
      // Return the resulting value to the caller.
      return cb(null, false);
    }
    // Create the allowed mimes constant.
    const allowedMimes = DOC_EXTENSION_TO_MIMETYPES[ext];
    // Evaluate the condition and enter the branch when it is true.
    if (!allowedMimes || !allowedMimes.includes((file.mimetype || '').toLowerCase())) {
      // Update req.fileRejected with the right-hand side value.
      req.fileRejected = true;
      // Update req.fileRejectedMessage with the right-hand side value.
      req.fileRejectedMessage = rejectedMessage;
      // Return the resulting value to the caller.
      return cb(null, false);
    }
    // Call cb to perform this step.
    cb(null, true);
  };
}

// Create the document upload constant.
const documentUpload = multer({
  // Provide the storage field value.
  storage: diskStorage,
  // Provide the file filter field value.
  fileFilter: createFileFilter(
    // Contribute this line to the enclosing declaration or statement.
    ALLOWED_DOC_EXTENSIONS,
    // Supply the literal value used by the enclosing expression.
    'Only JPG, PNG, WEBP, or PDF files are allowed.'
  ),
  // Provide the limits field value.
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Create the image upload constant.
const imageUpload = multer({
  // Provide the storage field value.
  storage: diskStorage,
  // Provide the file filter field value.
  fileFilter: createFileFilter(
    // Contribute this line to the enclosing declaration or statement.
    ALLOWED_IMAGE_EXTENSIONS,
    // Continue the surrounding logic with this statement.
    'Only image files are allowed (JPG, JPEG, PNG, WEBP).'
  ),
  // Provide the limits field value.
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * Verify a single private document via extension + magic bytes; delete and set validation error on failure.
 * Side effects: may delete temp file and set `req.fileValidationError`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
async function validatePrivateDocument(req, res, next) {
  // Create the file constant.
  const file = req.file;
  // Evaluate the condition and enter the branch when it is true.
  if (!file) {
    // Return the resulting value to the caller.
    return next();
  }

  // Start a try block for operations that may fail.
  try {
    // Create the ext constant.
    const ext = getNormalizedExtension(file.originalname || file.filename);
    // Create the saved ext constant.
    const savedExt = path.extname(file.filename || '').toLowerCase();
    // Evaluate the condition and enter the branch when it is true.
    if (!ALLOWED_DOC_EXTENSIONS.has(ext) || ext !== savedExt) {
      // Wait until the asynchronous operation resolves.
      await removeUploadedFile(file);
      // Update req.fileValidationError with the right-hand side value.
      req.fileValidationError = 'Only JPG, PNG, WEBP, or PDF files are allowed.';
      // Return the resulting value to the caller.
      return next();
    }

    // Create the head constant.
    const head = await readFileHead(file.path, 12);
    // Create the valid constant.
    const valid =
      // Update ext with the right-hand side value.
      ext === '.pdf' ? matchesPdfMagic(head) : matchesImageMagic(head, ext);
    // Evaluate the condition and enter the branch when it is true.
    if (!valid) {
      // Wait until the asynchronous operation resolves.
      await removeUploadedFile(file);
      // Update req.fileValidationError with the right-hand side value.
      req.fileValidationError = 'Uploaded file content is invalid.';
      // Return the resulting value to the caller.
      return next();
    }

    // Return the resulting value to the caller.
    return next();
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await removeUploadedFile(file);
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'EACCES' || err.code === 'ENOSPC') {
      // Return the resulting value to the caller.
      return next(err);
    }
    // Update req.fileValidationError with the right-hand side value.
    req.fileValidationError = 'Uploaded file content is invalid.';
    // Return the resulting value to the caller.
    return next();
  }
}

/**
 * Validate all uploaded private images (fields or array); remove all on first failure.
 * Side effects: may delete temps and set `req.fileValidationError`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
async function validatePrivateImages(req, res, next) {
  // Create the files constant.
  const files = [];
  // Normalize multer shapes: array, fields object, or single file.
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
  // Continue the surrounding logic with this statement.
  } else if (req.file) {
    // Call files.push to perform this step.
    files.push(req.file);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!files.length) {
    // Return the resulting value to the caller.
    return next();
  }

  // Start a try block for operations that may fail.
  try {
    // Iterate using the loop initializer, condition, and step.
    for (const file of files) {
      // Create the ext constant.
      const ext = getNormalizedExtension(file.originalname || file.filename);
      // Create the saved ext constant.
      const savedExt = path.extname(file.filename || '').toLowerCase();
      // Evaluate the condition and enter the branch when it is true.
      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext) || ext !== savedExt) {
        // Update req.fileValidationError with the right-hand side value.
        req.fileValidationError = 'Only image files are allowed (JPG, JPEG, PNG, WEBP).';
        // Iterate using the loop initializer, condition, and step.
        for (const f of files) await removeUploadedFile(f);
        // Return the resulting value to the caller.
        return next();
      }
      // Create the head constant.
      const head = await readFileHead(file.path, 12);
      // Evaluate the condition and enter the branch when it is true.
      if (!matchesImageMagic(head, ext)) {
        // Update req.fileValidationError with the right-hand side value.
        req.fileValidationError = 'Uploaded file is not a valid image.';
        // Iterate using the loop initializer, condition, and step.
        for (const f of files) await removeUploadedFile(f);
        // Return the resulting value to the caller.
        return next();
      }
    }
    // Return the resulting value to the caller.
    return next();
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Iterate using the loop initializer, condition, and step.
    for (const f of files) await removeUploadedFile(f);
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'EACCES' || err.code === 'ENOSPC') {
      // Return the resulting value to the caller.
      return next(err);
    }
    // Update req.fileValidationError with the right-hand side value.
    req.fileValidationError = 'Uploaded file is not a valid image.';
    // Return the resulting value to the caller.
    return next();
  }
}

/**
 * Turn `req.fileValidationError` into a 422 API response when present.
 * Side effects: may write a 422 JSON error.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void|import('express').Response}
 */
function rejectIfFileValidationFailed(req, res, next) {
  // Evaluate the condition and enter the branch when it is true.
  if (req.fileValidationError) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
  }
  // Return the resulting value to the caller.
  return next();
}

/** Middleware chain for customer account document uploads. */
const customerDocumentUpload = [
  // Contribute this line to the enclosing declaration or statement.
  accountUploadLimiter || adminUploadLimiter,
  // Contribute this line to the enclosing declaration or statement.
  releaseTempUploadsOnEarlyExit,
  // Call documentUpload.single to perform this step.
  documentUpload.single('file'),
  // Contribute this line to the enclosing declaration or statement.
  handleMulterError,
  // Contribute this line to the enclosing declaration or statement.
  handleFileRejected,
  // Contribute this line to the enclosing declaration or statement.
  validatePrivateDocument,
  // Contribute this line to the enclosing declaration or statement.
  rejectIfFileValidationFailed,
];

/** Middleware chain for admin private document uploads. */
const adminPrivateDocumentUpload = [
  // Contribute this line to the enclosing declaration or statement.
  adminUploadLimiter,
  // Contribute this line to the enclosing declaration or statement.
  releaseTempUploadsOnEarlyExit,
  // Call documentUpload.single to perform this step.
  documentUpload.single('file'),
  // Contribute this line to the enclosing declaration or statement.
  handleMulterError,
  // Contribute this line to the enclosing declaration or statement.
  handleFileRejected,
  // Contribute this line to the enclosing declaration or statement.
  validatePrivateDocument,
  // Contribute this line to the enclosing declaration or statement.
  rejectIfFileValidationFailed,
];

/** Middleware chain for checklist photos and signature image fields. */
const checklistUpload = [
  // Contribute this line to the enclosing declaration or statement.
  adminUploadLimiter,
  // Contribute this line to the enclosing declaration or statement.
  releaseTempUploadsOnEarlyExit,
  // Call imageUpload.fields to perform this step.
  imageUpload.fields([
    // Contribute this line to the enclosing declaration or statement.
    { name: 'photos', maxCount: 5 },
    // Contribute this line to the enclosing declaration or statement.
    { name: 'customerSignature', maxCount: 1 },
    // Contribute this line to the enclosing declaration or statement.
    { name: 'employeeSignature', maxCount: 1 },
  ]),
  // Contribute this line to the enclosing declaration or statement.
  handleMulterError,
  // Contribute this line to the enclosing declaration or statement.
  handleFileRejected,
  // Contribute this line to the enclosing declaration or statement.
  validatePrivateImages,
  // Contribute this line to the enclosing declaration or statement.
  rejectIfFileValidationFailed,
];

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  customerDocumentUpload,
  // Contribute this line to the enclosing declaration or statement.
  adminPrivateDocumentUpload,
  // Contribute this line to the enclosing declaration or statement.
  checklistUpload,
  // Contribute this line to the enclosing declaration or statement.
  validatePrivateDocument,
  // Contribute this line to the enclosing declaration or statement.
  validatePrivateImages,
};
