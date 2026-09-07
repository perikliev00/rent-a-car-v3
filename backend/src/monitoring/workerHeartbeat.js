const metrics = require('./metrics');

const DEFAULT_INTERVAL_MS = 15_000;

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
