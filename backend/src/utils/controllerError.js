const { AppError } = require('./appError');
const { buildErrorPayload } = require('./httpResponse');

function forwardControllerError(err, req, next, options = {}) {
  const { publicMessage, context } = options;

  if (publicMessage) {
    err.publicMessage = publicMessage;
  }

  if (context) {
    err.controllerContext = context;
  }

  return next(err);
}

function respondJsonError(res, req, options = {}) {
  const {
    status = 500,
    code = 'INTERNAL_ERROR',
    message = 'An unexpected error occurred. Please try again later.',
  } = options;

  const error = new AppError(code, status, message);
  return res.status(status).json(buildErrorPayload(error, req));
}

module.exports = {
  forwardControllerError,
  respondJsonError,
};
