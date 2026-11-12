/**
 * Typed Error factory for refund domain failures (code + HTTP status for API mapping).
 */

/**
 * @param {string} code - Machine-readable error code (e.g. REFUND_NOT_ALLOWED)
 * @param {string} message - Human-readable message
 * @param {number} [status=422] - Suggested HTTP status
 * @returns {Error}
 */
function refundError(code, message, status = 422) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

module.exports = { refundError };
