/**
 * HTTP response helpers for standardized error payloads.
 */

/**
 * Resolve the request correlation id attached by middleware.
 *
 * @param {import('express').Request} req
 * @returns {string | null}
 * @throws {never}
 */
function getRequestIdFromReq(req) {
  return req.requestId || req.correlationId || null;
}

/**
 * Build the standard `{ error: { code, message, requestId, correlationId } }` payload.
 *
 * @param {{ code: string, message: string }} error
 * @param {import('express').Request} req
 * @returns {{ error: { code: string, message: string, requestId: string | null, correlationId: string | null } }}
 * @throws {never}
 */
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
  buildErrorPayload,
  getRequestIdFromReq,
};
