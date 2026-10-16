/**
 * Shared helpers for admin car controllers (validation errors, upload cleanup, not-found mapping).
 */
const { removeUploadedFile } = require('../../../../middleware/fileUpload/uploadUtils');
const apiResponse = require('../../../../utils/apiResponse');
const { forwardControllerError } = require('../../../../utils/controllerError');

/**
 * Respond with 422 VALIDATION_ERROR for express-validator style errors.
 * Side effects: writes a 422 JSON API error.
 * @param {import('express').Response} res
 * @param {import('express-validator').Result} errors - Result from `validationResult(req)`
 * @returns {import('express').Response}
 */
function validationErrorResponse(res, errors) {
  return apiResponse.error(
    res,
    'VALIDATION_ERROR',
    errors.array()[0].msg,
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
  if (req.file) await removeUploadedFile(req.file);
  if (Array.isArray(req.files)) {
    for (const file of req.files) {
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
  if (err.message === 'Car not found' || err.message?.includes('not found')) {
    return apiResponse.error(res, 'NOT_FOUND', err.message, 404);
  }
  return forwardControllerError(err, req, next, { context, publicMessage });
}

module.exports = {
  validationErrorResponse,
  cleanupUploads,
  notFoundOrForward,
};
