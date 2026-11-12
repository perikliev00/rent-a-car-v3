/**
 * Periodic worker liveness signal written to the `worker_heartbeat_unixtime` gauge.
 */

const metrics = require('./metrics');

// Create the default interval ms constant.
const DEFAULT_INTERVAL_MS = 15_000;

/**
 * Start heartbeat interval; returns the timer handle for shutdown.
 *
 * @param {number} [intervalMs]
 * @returns {NodeJS.Timeout}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function startWorkerHeartbeat(intervalMs = DEFAULT_INTERVAL_MS) {
  // Create the beat constant.
  const beat = () => {
    // Call metrics.setWorkerHeartbeat to perform this step.
    metrics.setWorkerHeartbeat();
  };

  // Call beat to perform this step.
  beat();
  // Return the resulting value to the caller.
  return setInterval(beat, intervalMs);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  startWorkerHeartbeat,
};
