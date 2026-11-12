/**
 * Periodic worker liveness signal written to the `worker_heartbeat_unixtime` gauge.
 */

const metrics = require('./metrics');

const DEFAULT_INTERVAL_MS = 15_000;

/**
 * Start heartbeat interval; returns the timer handle for shutdown.
 *
 * @param {number} [intervalMs]
 * @returns {NodeJS.Timeout}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function startWorkerHeartbeat(intervalMs = DEFAULT_INTERVAL_MS) {
  const beat = () => {
    metrics.setWorkerHeartbeat();
  };

  beat();
  return setInterval(beat, intervalMs);
}

module.exports = {
  startWorkerHeartbeat,
};
