function wantsJson(req) {
  if (req.path === '/webhook/stripe') return true;
  if (req.xhr) return true;
  if (req.path.startsWith('/api/')) return true;

  const accept = req.get('accept') || '';
  return accept.includes('application/json') && !accept.includes('text/html');
}

function getRequestIdFromReq(req) {
  return req.requestId || req.correlationId || null;
}

function buildErrorPayload(error, req) {
  const requestId = getRequestIdFromReq(req);
  return {
    error: {
      code: error.code,
      message: error.message,
      requestId,
      correlationId: requestId,
    },
  };
}

module.exports = {
  wantsJson,
  buildErrorPayload,
  getRequestIdFromReq,
};
