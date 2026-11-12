/**
 * Shared helpers for admin car controllers (validation errors, upload cleanup, not-found mapping).
 */
const { removeUploadedFile } = require('../../../../middleware/fileUpload/uploadUtils');
// Require the '../../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../../utils/apiResponse');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../../utils/controllerError');

/**
 * Respond with 422 VALIDATION_ERROR for express-validator style errors.
 * Side effects: writes a 422 JSON API error.
 * @param {import('express').Response} res
 * @param {import('express-validator').Result} errors - Result from `validationResult(req)`
 * @returns {import('express').Response}
 */
function validationErrorResponse(res, errors) {
  // Return the resulting value to the caller.
  return apiResponse.error(
    // Contribute this line to the enclosing declaration or statement.
    res,
    // Supply the literal value used by the enclosing expression.
    'VALIDATION_ERROR',
    // Call errors.array to perform this step.
    errors.array()[0].msg,
    // Supply the literal value used by the enclosing expression.
    422
  );
}

/**
 * Best-effort delete of uploaded temp files attached to the request.
 * Side effects: deletes `req.file` / `req.files` from temp storage when present.
 * @param {import('express').Request} req
 * @returns {Promise<void>}
 */
async function cleanupUploads(req) {
  // Evaluate the condition and enter the branch when it is true.
  if (req.file) await removeUploadedFile(req.file);
  // Evaluate the condition and enter the branch when it is true.
  if (Array.isArray(req.files)) {
    // Iterate using the loop initializer, condition, and step.
    for (const file of req.files) {
      // Wait until the asynchronous operation resolves.
      await removeUploadedFile(file);
    }
  }
}

/**
 * Map domain not-found errors to 404 responses; otherwise forward to the error middleware.
 * Side effects: may write 404 or call `next` via `forwardControllerError`.
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {string} context - Controller context label for logs
 * @param {string} publicMessage - Safe client message when forwarding
 * @returns {*|void}
 */
function notFoundOrForward(err, req, res, next, context, publicMessage) {
  // Evaluate the condition and enter the branch when it is true.
  if (err.message === 'Car not found' || err.message?.includes('not found')) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'NOT_FOUND', err.message, 404);
  }
  // Return the resulting value to the caller.
  return forwardControllerError(err, req, next, { context, publicMessage });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  validationErrorResponse,
  // Contribute this line to the enclosing declaration or statement.
  cleanupUploads,
  // Contribute this line to the enclosing declaration or statement.
  notFoundOrForward,
};
