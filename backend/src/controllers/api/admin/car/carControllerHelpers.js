const { removeUploadedFile } = require('../../../../middleware/fileUpload/uploadUtils');
const apiResponse = require('../../../../utils/apiResponse');
const { forwardControllerError } = require('../../../../utils/controllerError');

function validationErrorResponse(res, errors) {
  return apiResponse.error(
    res,
    'VALIDATION_ERROR',
    errors.array()[0].msg,
    422
  );
}

async function cleanupUploads(req) {
  if (req.file) await removeUploadedFile(req.file);
  if (Array.isArray(req.files)) {
    for (const file of req.files) {
      await removeUploadedFile(file);
    }
  }
}

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
