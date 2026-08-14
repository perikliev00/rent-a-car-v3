/**
 * Returns 503 while the process is shutting down so new work is rejected.
 * @param {() => boolean} getIsShuttingDown
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
