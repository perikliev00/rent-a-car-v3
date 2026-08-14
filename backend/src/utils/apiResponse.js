const { getRequestIdFromReq } = require('./httpResponse');

function success(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    data,
  });
}

function error(res, code, message, status = 500, req = null) {
  const requestId = req ? getRequestIdFromReq(req) : null;
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(requestId ? { requestId, correlationId: requestId } : {}),
    },
  });
}

module.exports = {
  success,
  error,
};
