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
  // Evaluate the condition and enter the branch when it is true.
  if (req.xhr) return true;
  // Evaluate the condition and enter the branch when it is true.
  if (req.path.startsWith('/api/')) return true;

  // Prefer JSON when Accept lists it and does not also ask for HTML.
  const accept = req.get('accept') || '';
  // Return the resulting value to the caller.
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
  // Return the resulting value to the caller.
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
  // Create the request id constant.
  const requestId = getRequestIdFromReq(req);
  // Return the resulting value to the caller.
  return {
    // Provide the error field value.
    error: {
      // Provide the code field value.
      code: error.code,
      // Provide the message field value.
      message: error.message,
      // Contribute this line to the enclosing declaration or statement.
      requestId,
      // Provide the correlation id field value.
      correlationId: requestId,
    },
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  wantsJson,
  // Contribute this line to the enclosing declaration or statement.
  buildErrorPayload,
  // Contribute this line to the enclosing declaration or statement.
  getRequestIdFromReq,
};
