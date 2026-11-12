/**
 * Middleware factory that rejects new HTTP work with 503 during graceful shutdown.
 */

/**
 * Returns 503 while the process is shutting down so new work is rejected.
 * Side effects: may write a 503 JSON body when the gate is closed.
 * @param {() => boolean} getIsShuttingDown - Live getter for the process shutdown flag
 * @returns {import('express').RequestHandler}
 */
function createShutdownGate(getIsShuttingDown) {
  // Return the resulting value to the caller.
  return function shutdownGate(req, res, next) {
    // Evaluate the condition and enter the branch when it is true.
    if (!getIsShuttingDown()) {
      // Return the resulting value to the caller.
      return next();
    }

    // Return the resulting value to the caller.
    return res.status(503).json({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'SERVICE_UNAVAILABLE',
        // Provide the message field value.
        message: 'Server is restarting. Please retry in a few moments.',
        // Provide the request id field value.
        requestId: req.requestId,
        // Provide the correlation id field value.
        correlationId: req.requestId,
      },
    });
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createShutdownGate,
};
