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
  // Create the err constant.
  const err = new Error(message);
  // Update err.code with the right-hand side value.
  err.code = code;
  // Update err.status with the right-hand side value.
  err.status = status;
  // Return the resulting value to the caller.
  return err;
}

// Assign the CommonJS module exports.
module.exports = { refundError };
