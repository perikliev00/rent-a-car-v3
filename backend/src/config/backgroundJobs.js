/**
 * Controls whether this Node process runs in-process background jobs
 * (cleanup timers, notification scheduler/worker). See `isBackgroundJobsEnabled`.
 */

/**
 * Whether this process should run in-process background jobs
 * (cleanup timers, notification scheduler/worker).
 *
 * Unset / empty → enabled (safe default for single-replica).
 * Explicit falsey: 0, false, no, off
 * Explicit truthy: 1, true, yes, on
 * Unknown values fall through to enabled (fail-open for single-node deploys).
 * @param {string|undefined|null} [raw=process.env.RUN_BACKGROUND_JOBS] - Raw env string to parse
 * @returns {boolean} True when this process should start background jobs
 */
function isBackgroundJobsEnabled(raw = process.env.RUN_BACKGROUND_JOBS) {
  // Default on when unset so a lone API process still cleans holds / sends notifications.
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
  // Unrecognized value: keep jobs on rather than silently disabling them.
  return true;
}

module.exports = {
  isBackgroundJobsEnabled,
};
