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
  return function shutdownGate(req, res, next) {
    if (!getIsShuttingDown()) {
      return next();
    }

    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Server is restarting. Please retry in a few moments.',
        requestId: req.requestId,
        correlationId: req.requestId,
      },
    });
  };
}

module.exports = {
  createShutdownGate,
};
