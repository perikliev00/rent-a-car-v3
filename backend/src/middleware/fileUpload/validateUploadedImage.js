/**
 * Post-multer validation: extension/MIME/magic checks, then re-encode and promote public images.
 */
const path = require('path');
const {
  getNormalizedExtension,
  isAllowedImageExtension,
  isAllowedImageMimetype,
  matchesImageMagic,
  reencodeAndPromoteUpload,
  readFileHead,
  removeUploadedFile,
} = require('./uploadUtils');

/**
 * Validate and promote a single uploaded image; returns an error message or null on success.
 * Side effects: may delete invalid temps; on success re-encodes and promotes the file.
 * @param {Express.Multer.File} file
 * @returns {Promise<string|null>} Human-readable error, or null when valid
 */
async function validateOneUploadedImage(file) {
  const ext = getNormalizedExtension(file.originalname || file.filename);
  const savedExt = path.extname(file.filename || '').toLowerCase();

  // Extension on original name must match the generated stored filename extension.
  if (!isAllowedImageExtension(ext) || ext !== savedExt) {
    await removeUploadedFile(file);
    return 'Only image files are allowed (JPG, JPEG, PNG, WEBP).';
  }

  if (!isAllowedImageMimetype(ext, file.mimetype)) {
    await removeUploadedFile(file);
    return 'Uploaded file MIME type does not match a supported image format.';
  }

  const head = await readFileHead(file.path);
  if (!matchesImageMagic(head, ext)) {
    await removeUploadedFile(file);
    return 'Uploaded file is not a valid image.';
  }

  await reencodeAndPromoteUpload(file);
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
  const file = req.file;
  if (!file) {
    return next();
  }

  try {
    const error = await validateOneUploadedImage(file);
    if (error) {
      req.fileValidationError = error;
    }
    return next();
  } catch (err) {
    await removeUploadedFile(file);
    // Disk/permission failures should surface as 500 via the global handler.
    if (err.code === 'EACCES' || err.code === 'ENOSPC') {
      return next(err);
    }
    req.fileValidationError = 'Uploaded file is not a valid image.';
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
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return next();
  }

  try {
    for (const file of files) {
      const error = await validateOneUploadedImage(file);
      if (error) {
        req.fileValidationError = error;
        // Clean up siblings that were already accepted by multer.
        for (const remaining of files) {
          if (remaining !== file) {
            await removeUploadedFile(remaining);
          }
        }
        return next();
      }
    }
    return next();
  } catch (err) {
    for (const file of files) {
      await removeUploadedFile(file);
    }
    if (err.code === 'EACCES' || err.code === 'ENOSPC') {
      return next(err);
    }
    req.fileValidationError = 'Uploaded file is not a valid image.';
    return next();
  }
}

module.exports = { validateUploadedImage, validateUploadedImages };
