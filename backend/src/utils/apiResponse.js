/**
 * Thin helpers for consistent JSON success/error API envelopes.
 */

const { getRequestIdFromReq } = require('./httpResponse');

/**
 * Send a successful JSON response: `{ success: true, data }`.
 *
 * @param {import('express').Response} res - Express response
 * @param {unknown} data - Payload under `data`
 * @param {number} [status=200] - HTTP status code
 * @returns {import('express').Response}
 * @throws {never}
 */
function success(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    data,
  });
}

/**
 * Send a failed JSON response with a machine-readable code and optional request correlation ids.
 *
 * @param {import('express').Response} res - Express response
 * @param {string} code - Machine-readable error code (see ERROR_CODES)
 * @param {string} message - Human-readable message
 * @param {number} [status=500] - HTTP status code
 * @param {import('express').Request | null} [req=null] - Optional request for requestId
 * @returns {import('express').Response}
 * @throws {never}
 */
function error(res, code, message, status = 500, req = null) {
  // Correlate errors to the inbound request when available.
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
