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
  // Evaluate the condition and enter the branch when it is true.
  if (err && err.name === 'MulterError') {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'LIMIT_FILE_SIZE') {
      // Update req.fileValidationError with the right-hand side value.
      req.fileValidationError = 'File size exceeds 5MB limit';
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Update req.fileValidationError with the right-hand side value.
      req.fileValidationError = err.message || 'File upload error';
    }
    // Soft-fail so rejectIfFileValidationFailed / controllers can return 422.
    return next();
  }
  // Call next to perform this step.
  next(err);
};

// Assign the CommonJS module exports.
module.exports = { handleMulterError };
