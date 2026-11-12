/**
 * Post-multer validation: extension/MIME/magic checks, then re-encode and promote public images.
 */
const path = require('path');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  getNormalizedExtension,
  // Contribute this line to the enclosing declaration or statement.
  isAllowedImageExtension,
  // Contribute this line to the enclosing declaration or statement.
  isAllowedImageMimetype,
  // Contribute this line to the enclosing declaration or statement.
  matchesImageMagic,
  // Contribute this line to the enclosing declaration or statement.
  reencodeAndPromoteUpload,
  // Contribute this line to the enclosing declaration or statement.
  readFileHead,
  // Contribute this line to the enclosing declaration or statement.
  removeUploadedFile,
// Continue the surrounding logic with this statement.
} = require('./uploadUtils');

/**
 * Validate and promote a single uploaded image; returns an error message or null on success.
 * Side effects: may delete invalid temps; on success re-encodes and promotes the file.
 * @param {Express.Multer.File} file
 * @returns {Promise<string|null>} Human-readable error, or null when valid
 */
async function validateOneUploadedImage(file) {
  // Create the ext constant.
  const ext = getNormalizedExtension(file.originalname || file.filename);
  // Create the saved ext constant.
  const savedExt = path.extname(file.filename || '').toLowerCase();

  // Extension on original name must match the generated stored filename extension.
  if (!isAllowedImageExtension(ext) || ext !== savedExt) {
    // Wait until the asynchronous operation resolves.
    await removeUploadedFile(file);
    // Return the resulting value to the caller.
    return 'Only image files are allowed (JPG, JPEG, PNG, WEBP).';
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!isAllowedImageMimetype(ext, file.mimetype)) {
    // Wait until the asynchronous operation resolves.
    await removeUploadedFile(file);
    // Return the resulting value to the caller.
    return 'Uploaded file MIME type does not match a supported image format.';
  }

  // Create the head constant.
  const head = await readFileHead(file.path);
  // Evaluate the condition and enter the branch when it is true.
  if (!matchesImageMagic(head, ext)) {
    // Wait until the asynchronous operation resolves.
    await removeUploadedFile(file);
    // Return the resulting value to the caller.
    return 'Uploaded file is not a valid image.';
  }

  // Wait until the asynchronous operation resolves.
  await reencodeAndPromoteUpload(file);
  // Return the resulting value to the caller.
  return null;
}

/**
 * Validate `req.file` when present; sets `req.fileValidationError` on soft failures.
 * Side effects: may delete temp file and set `req.fileValidationError`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
async function validateUploadedImage(req, res, next) {
  // Create the file constant.
  const file = req.file;
  // Evaluate the condition and enter the branch when it is true.
  if (!file) {
    // Return the resulting value to the caller.
    return next();
  }

  // Start a try block for operations that may fail.
  try {
    // Create the error constant.
    const error = await validateOneUploadedImage(file);
    // Evaluate the condition and enter the branch when it is true.
    if (error) {
      // Update req.fileValidationError with the right-hand side value.
      req.fileValidationError = error;
    }
    // Return the resulting value to the caller.
    return next();
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await removeUploadedFile(file);
    // Disk/permission failures should surface as 500 via the global handler.
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
 * Validate `req.files` array; removes remaining files if one fails validation.
 * Side effects: may delete all temps and set `req.fileValidationError`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
async function validateUploadedImages(req, res, next) {
  // Create the files constant.
  const files = Array.isArray(req.files) ? req.files : [];
  // Evaluate the condition and enter the branch when it is true.
  if (!files.length) {
    // Return the resulting value to the caller.
    return next();
  }

  // Start a try block for operations that may fail.
  try {
    // Iterate using the loop initializer, condition, and step.
    for (const file of files) {
      // Create the error constant.
      const error = await validateOneUploadedImage(file);
      // Evaluate the condition and enter the branch when it is true.
      if (error) {
        // Update req.fileValidationError with the right-hand side value.
        req.fileValidationError = error;
        // Clean up siblings that were already accepted by multer.
        for (const remaining of files) {
          // Evaluate the condition and enter the branch when it is true.
          if (remaining !== file) {
            // Wait until the asynchronous operation resolves.
            await removeUploadedFile(remaining);
          }
        }
        // Return the resulting value to the caller.
        return next();
      }
    }
    // Return the resulting value to the caller.
    return next();
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Iterate using the loop initializer, condition, and step.
    for (const file of files) {
      // Wait until the asynchronous operation resolves.
      await removeUploadedFile(file);
    }
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

// Assign the CommonJS module exports.
module.exports = { validateUploadedImage, validateUploadedImages };
