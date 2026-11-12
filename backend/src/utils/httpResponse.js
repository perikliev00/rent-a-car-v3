/**
 * HTTP response helpers for content negotiation and standardized error payloads.
 */

/**
 * Whether the client expects a JSON body (API path, XHR, Stripe webhook, or Accept header).
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 * @throws {never}
 */
function wantsJson(req) {
  // Stripe webhooks and XHR always get JSON.
  if (req.path === '/webhook/stripe') return true;
  if (req.xhr) return true;
  if (req.path.startsWith('/api/')) return true;

  // Prefer JSON when Accept lists it and does not also ask for HTML.
  const accept = req.get('accept') || '';
  return accept.includes('application/json') && !accept.includes('text/html');
}

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
  wantsJson,
  buildErrorPayload,
  getRequestIdFromReq,
};
