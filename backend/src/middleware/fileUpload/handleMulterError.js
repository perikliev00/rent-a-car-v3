/**
 * Convert MulterErrors into `req.fileValidationError` so later middleware can return 422.
 * Non-multer errors are forwarded to the global error handler.
 */

/**
 * Express error middleware specialized for multer failures (size limits, etc.).
 * Side effects: may set `req.fileValidationError` and continue the chain without failing hard.
 * @param {*} err - Error from previous middleware (often MulterError)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
const handleMulterError = (err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      req.fileValidationError = 'File size exceeds 5MB limit';
    } else {
      req.fileValidationError = err.message || 'File upload error';
    }
    // Soft-fail so rejectIfFileValidationFailed / controllers can return 422.
    return next();
  }
  next(err);
};

module.exports = { handleMulterError };
