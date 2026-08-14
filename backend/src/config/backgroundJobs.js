/**
 * Whether this process should run in-process background jobs
 * (cleanup timers, notification scheduler/worker, gauge poller).
 *
 * Unset / empty → enabled (safe default for single-replica).
 * Explicit falsey: 0, false, no, off
 * Explicit truthy: 1, true, yes, on
 */
function isBackgroundJobsEnabled(raw = process.env.RUN_BACKGROUND_JOBS) {
  if (raw == null || String(raw).trim() === '') {
    return true;
  }
  const value = String(raw).trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(value)) {
    return false;
  }
  if (['1', 'true', 'yes', 'on'].includes(value)) {
    return true;
  }
  return true;
}

module.exports = {
  isBackgroundJobsEnabled,
};
