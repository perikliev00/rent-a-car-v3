/**
 * Registers and runs periodic background maintenance jobs under advisory locks.
 * Jobs: outdated date cleanup, abandoned holds, image cleanup, fleet alerts, notifications.
 */

const logger = require('../utils/logger');
// Require the '../monitoring/metrics' module as metrics.
const metrics = require('../monitoring/metrics');
// Destructure object properties into local variables.
const { withJobLock } = require('../db/transaction');
// Destructure object properties into local variables.
const { cleanUpOutdatedDates } = require('../services/carService');
// Destructure object properties into local variables.
const { cleanUpAbandonedReservations } = require('../services/reservationService');
// Destructure object properties into local variables.
const { cleanupCarImages } = require('../services/storage/imageCleanupService');
// Destructure object properties into local variables.
const { runFleetAlertChecks } = require('../services/carFleetAlertReconcileService');
// Destructure object properties into local variables.
const { runNotificationScheduler } = require('../modules/notifications/notifications.scheduler');
// Destructure object properties into local variables.
const { processDueNotifications } = require('../modules/notifications/notifications.worker');

/** Stable lock keys for `withJobLock` (one holder per key across processes). */
const JOB_KEYS = Object.freeze({
  // Provide the outdated dates field value.
  OUTDATED_DATES: 'cleanup.outdated_dates',
  // Provide the abandoned reservations field value.
  ABANDONED_RESERVATIONS: 'cleanup.abandoned_reservations',
  // Provide the car images field value.
  CAR_IMAGES: 'cleanup.car_images',
  // Provide the fleet alerts field value.
  FLEET_ALERTS: 'fleet.alerts',
  // Provide the notifications scheduler field value.
  NOTIFICATIONS_SCHEDULER: 'notifications.scheduler',
  // Provide the notifications worker field value.
  NOTIFICATIONS_WORKER: 'notifications.worker',
});

/** Interval between scheduled runs for each job. */
const INTERVALS_MS = Object.freeze({
  // Provide the outdated dates field value.
  OUTDATED_DATES: 3 * 60 * 1000,
  // Provide the abandoned reservations field value.
  ABANDONED_RESERVATIONS: 3 * 60 * 1000,
  // Provide the car images field value.
  CAR_IMAGES: 6 * 60 * 60 * 1000,
  // Provide the fleet alerts field value.
  FLEET_ALERTS: 3 * 60 * 1000,
  // Provide the notifications scheduler field value.
  NOTIFICATIONS_SCHEDULER: 10 * 60 * 1000,
  // Provide the notifications worker field value.
  NOTIFICATIONS_WORKER: 2 * 60 * 1000,
});

// Create the timers constant.
const timers = [];

/**
 * Execute a job under its advisory lock; skip when another process holds the lock.
 * Records success / failure metrics for monitoring.
 *
 * @param {string} jobKey - Stable key from {@link JOB_KEYS}
 * @param {() => Promise<unknown>} work - Job body (no client; uses module pools)
 * @returns {Promise<object>} Lock outcome (`skipped`, `result`, or `error`)
 * @throws {never} Errors from `work` / lock helpers are caught and returned / metered
 */
async function runLockedJob(jobKey, work) {
  // Start a try block for operations that may fail.
  try {
    // Acquire the per-job advisory lock; skip if another worker holds it.
    const outcome = await withJobLock(jobKey, async () => work());
    // Evaluate the condition and enter the branch when it is true.
    if (outcome?.skipped) {
      // Call logger.debug to perform this step.
      logger.debug({ jobKey }, 'Background job skipped (lock held)');
      // Return the resulting value to the caller.
      return outcome;
    }

    // withJobLock may surface a structured error without throwing.
    if (outcome?.error) {
      // Call metrics.incrementBackgroundJobFailure to perform this step.
      metrics.incrementBackgroundJobFailure(jobKey);
      // Return the resulting value to the caller.
      return outcome;
    }

    // Successful run → update last-success gauge for heartbeats / alerts.
    metrics.setBackgroundJobLastSuccess(jobKey);
    // Return the resulting value to the caller.
    return outcome;
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Unexpected throw from lock helper or work → meter + log, do not crash the process.
    metrics.incrementBackgroundJobFailure(jobKey);
    // Call logger.error to perform this step.
    logger.error({ err, jobKey }, 'Background job error');
    // Return the resulting value to the caller.
    return { skipped: false, error: err };
  }
}

/**
 * Register a recurring interval and track the timer for shutdown.
 *
 * @param {() => void} fn - Callback invoked on each tick
 * @param {number} intervalMs - Delay between ticks
 * @returns {NodeJS.Timeout} Timer handle
 * @throws {never}
 */
function registerInterval(fn, intervalMs) {
  // Create the timer constant.
  const timer = setInterval(fn, intervalMs);
  // Call timers.push to perform this step.
  timers.push(timer);
  // Return the resulting value to the caller.
  return timer;
}

/**
 * Run all jobs once, then register recurring intervals.
 *
 * @param {{ pool?: import('pg').Pool }} [options] - Optional pool (reserved for future jobs)
 * @returns {Promise<void>}
 * @throws {never} Individual job failures are swallowed inside {@link runLockedJob}
 */
async function startBackgroundJobs({ pool } = {}) {
  // pool is accepted for API symmetry / future jobs; business jobs use module pools.
  void pool;

  // Kick each job once at startup so the process is useful before the first interval.
  await runLockedJob(JOB_KEYS.OUTDATED_DATES, cleanUpOutdatedDates);
  // Wait until the asynchronous operation resolves.
  await runLockedJob(JOB_KEYS.ABANDONED_RESERVATIONS, cleanUpAbandonedReservations);
  // Wait until the asynchronous operation resolves.
  await runLockedJob(JOB_KEYS.CAR_IMAGES, cleanupCarImages);
  // Wait until the asynchronous operation resolves.
  await runLockedJob(JOB_KEYS.FLEET_ALERTS, runFleetAlertChecks);
  // Wait until the asynchronous operation resolves.
  await runLockedJob(JOB_KEYS.NOTIFICATIONS_SCHEDULER, runNotificationScheduler);
  // Wait until the asynchronous operation resolves.
  await runLockedJob(JOB_KEYS.NOTIFICATIONS_WORKER, () => processDueNotifications({ limit: 50 }));

  // Register recurring schedules (fire-and-forget each tick).
  registerInterval(
    // Continue the surrounding logic with this statement.
    () => {
      // Continue the surrounding logic with this statement.
      void runLockedJob(JOB_KEYS.OUTDATED_DATES, cleanUpOutdatedDates);
    },
    // Contribute this line to the enclosing declaration or statement.
    INTERVALS_MS.OUTDATED_DATES
  );
  // Call registerInterval to perform this step.
  registerInterval(
    // Continue the surrounding logic with this statement.
    () => {
      // Continue the surrounding logic with this statement.
      void runLockedJob(JOB_KEYS.ABANDONED_RESERVATIONS, cleanUpAbandonedReservations);
    },
    // Contribute this line to the enclosing declaration or statement.
    INTERVALS_MS.ABANDONED_RESERVATIONS
  );
  // Call registerInterval to perform this step.
  registerInterval(
    // Continue the surrounding logic with this statement.
    () => {
      // Continue the surrounding logic with this statement.
      void runLockedJob(JOB_KEYS.CAR_IMAGES, cleanupCarImages);
    },
    // Contribute this line to the enclosing declaration or statement.
    INTERVALS_MS.CAR_IMAGES
  );
  // Call registerInterval to perform this step.
  registerInterval(
    // Continue the surrounding logic with this statement.
    () => {
      // Continue the surrounding logic with this statement.
      void runLockedJob(JOB_KEYS.FLEET_ALERTS, runFleetAlertChecks);
    },
    // Contribute this line to the enclosing declaration or statement.
    INTERVALS_MS.FLEET_ALERTS
  );
  // Call registerInterval to perform this step.
  registerInterval(
    // Continue the surrounding logic with this statement.
    () => {
      // Continue the surrounding logic with this statement.
      void runLockedJob(JOB_KEYS.NOTIFICATIONS_SCHEDULER, runNotificationScheduler);
    },
    // Contribute this line to the enclosing declaration or statement.
    INTERVALS_MS.NOTIFICATIONS_SCHEDULER
  );
  // Call registerInterval to perform this step.
  registerInterval(
    // Continue the surrounding logic with this statement.
    () => {
      // Continue the surrounding logic with this statement.
      void runLockedJob(JOB_KEYS.NOTIFICATIONS_WORKER, () =>
        // Call processDueNotifications to perform this step.
        processDueNotifications({ limit: 50 })
      );
    },
    // Contribute this line to the enclosing declaration or statement.
    INTERVALS_MS.NOTIFICATIONS_WORKER
  );

  // Call logger.info to perform this step.
  logger.info('Background jobs enabled');
}

/**
 * Clear all registered interval timers (graceful shutdown).
 *
 * @returns {void}
 * @throws {never}
 */
function stopBackgroundJobs() {
  // Drain the timer list so no further ticks fire after shutdown begins.
  while (timers.length) {
    // Call clearInterval to perform this step.
    clearInterval(timers.pop());
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  JOB_KEYS,
  // Contribute this line to the enclosing declaration or statement.
  INTERVALS_MS,
  // Contribute this line to the enclosing declaration or statement.
  runLockedJob,
  // Contribute this line to the enclosing declaration or statement.
  startBackgroundJobs,
  // Contribute this line to the enclosing declaration or statement.
  stopBackgroundJobs,
};
