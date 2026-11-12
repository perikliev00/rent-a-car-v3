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
  // Return the resulting value to the caller.
  return res.status(status).json({
    // Provide the success field value.
    success: true,
    // Contribute this line to the enclosing declaration or statement.
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
  // Return the resulting value to the caller.
  return res.status(status).json({
    // Provide the success field value.
    success: false,
    // Provide the error field value.
    error: {
      // Contribute this line to the enclosing declaration or statement.
      code,
      // Contribute this line to the enclosing declaration or statement.
      message,
      // Call ... to perform this step.
      ...(requestId ? { requestId, correlationId: requestId } : {}),
    },
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  success,
  // Contribute this line to the enclosing declaration or statement.
  error,
};
