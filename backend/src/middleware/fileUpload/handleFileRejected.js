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
  // Evaluate the condition and enter the branch when it is true.
  if (req.fileRejected) {
    // Update req.fileValidationError with the right-hand side value.
    req.fileValidationError =
      // Contribute this line to the enclosing declaration or statement.
      req.fileRejectedMessage ||
      // Continue the surrounding logic with this statement.
      'Only image files are allowed (JPG, JPEG, PNG, WEBP) with a matching MIME type.';
  }
  // Call next to perform this step.
  next();
};

// Assign the CommonJS module exports.
module.exports = { handleFileRejected };
