/**
 * Promote soft fileFilter rejections (`req.fileRejected`) into `req.fileValidationError`.
 */

/**
 * After multer, translate filter soft-rejects into a validation message for 422 handlers.
 * Side effects: may set `req.fileValidationError` from `req.fileRejectedMessage`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
const handleFileRejected = (req, res, next) => {
  if (req.fileRejected) {
    req.fileValidationError =
      req.fileRejectedMessage ||
      'Only image files are allowed (JPG, JPEG, PNG, WEBP) with a matching MIME type.';
  }
  next();
};

module.exports = { handleFileRejected };
