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

async function validateOneUploadedImage(file) {
  const ext = getNormalizedExtension(file.originalname || file.filename);
  const savedExt = path.extname(file.filename || '').toLowerCase();

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
    if (err.code === 'EACCES' || err.code === 'ENOSPC') {
      return next(err);
    }
    req.fileValidationError = 'Uploaded file is not a valid image.';
    return next();
  }
}

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
