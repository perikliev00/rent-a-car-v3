/**
 * Registers and runs periodic background maintenance jobs under advisory locks.
 * Jobs: outdated date cleanup, abandoned holds, image cleanup, fleet alerts, notifications.
 */

const logger = require('../utils/logger');
const metrics = require('../monitoring/metrics');
const { withJobLock } = require('../db/transaction');
const { cleanUpOutdatedDates } = require('../services/carService');
const { cleanUpAbandonedReservations } = require('../services/reservationService');
const { cleanupCarImages } = require('../services/storage/imageCleanupService');
const { runFleetAlertChecks } = require('../services/carFleetAlertReconcileService');
const { runNotificationScheduler } = require('../modules/notifications/notifications.scheduler');
const { processDueNotifications } = require('../modules/notifications/notifications.worker');

/** Stable lock keys for `withJobLock` (one holder per key across processes). */
const JOB_KEYS = Object.freeze({
  OUTDATED_DATES: 'cleanup.outdated_dates',
  ABANDONED_RESERVATIONS: 'cleanup.abandoned_reservations',
  CAR_IMAGES: 'cleanup.car_images',
  FLEET_ALERTS: 'fleet.alerts',
  NOTIFICATIONS_SCHEDULER: 'notifications.scheduler',
  NOTIFICATIONS_WORKER: 'notifications.worker',
});

/** Interval between scheduled runs for each job. */
const INTERVALS_MS = Object.freeze({
  OUTDATED_DATES: 3 * 60 * 1000,
  ABANDONED_RESERVATIONS: 3 * 60 * 1000,
  CAR_IMAGES: 6 * 60 * 60 * 1000,
  FLEET_ALERTS: 3 * 60 * 1000,
  NOTIFICATIONS_SCHEDULER: 10 * 60 * 1000,
  NOTIFICATIONS_WORKER: 2 * 60 * 1000,
});

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
  try {
    // Acquire the per-job advisory lock; skip if another worker holds it.
    const outcome = await withJobLock(jobKey, async () => work());
    if (outcome?.skipped) {
      logger.debug({ jobKey }, 'Background job skipped (lock held)');
      return outcome;
    }

    // withJobLock may surface a structured error without throwing.
    if (outcome?.error) {
      metrics.incrementBackgroundJobFailure(jobKey);
      return outcome;
    }

    // Successful run → update last-success gauge for heartbeats / alerts.
    metrics.setBackgroundJobLastSuccess(jobKey);
    return outcome;
  } catch (err) {
    // Unexpected throw from lock helper or work → meter + log, do not crash the process.
    metrics.incrementBackgroundJobFailure(jobKey);
    logger.error({ err, jobKey }, 'Background job error');
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
  const timer = setInterval(fn, intervalMs);
  timers.push(timer);
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
  await runLockedJob(JOB_KEYS.ABANDONED_RESERVATIONS, cleanUpAbandonedReservations);
  await runLockedJob(JOB_KEYS.CAR_IMAGES, cleanupCarImages);
  await runLockedJob(JOB_KEYS.FLEET_ALERTS, runFleetAlertChecks);
  await runLockedJob(JOB_KEYS.NOTIFICATIONS_SCHEDULER, runNotificationScheduler);
  await runLockedJob(JOB_KEYS.NOTIFICATIONS_WORKER, () => processDueNotifications({ limit: 50 }));

  // Register recurring schedules (fire-and-forget each tick).
  registerInterval(
    () => {
      void runLockedJob(JOB_KEYS.OUTDATED_DATES, cleanUpOutdatedDates);
    },
    INTERVALS_MS.OUTDATED_DATES
  );
  registerInterval(
    () => {
      void runLockedJob(JOB_KEYS.ABANDONED_RESERVATIONS, cleanUpAbandonedReservations);
    },
    INTERVALS_MS.ABANDONED_RESERVATIONS
  );
  registerInterval(
    () => {
      void runLockedJob(JOB_KEYS.CAR_IMAGES, cleanupCarImages);
    },
    INTERVALS_MS.CAR_IMAGES
  );
  registerInterval(
    () => {
      void runLockedJob(JOB_KEYS.FLEET_ALERTS, runFleetAlertChecks);
    },
    INTERVALS_MS.FLEET_ALERTS
  );
  registerInterval(
    () => {
      void runLockedJob(JOB_KEYS.NOTIFICATIONS_SCHEDULER, runNotificationScheduler);
    },
    INTERVALS_MS.NOTIFICATIONS_SCHEDULER
  );
  registerInterval(
    () => {
      void runLockedJob(JOB_KEYS.NOTIFICATIONS_WORKER, () =>
        processDueNotifications({ limit: 50 })
      );
    },
    INTERVALS_MS.NOTIFICATIONS_WORKER
  );

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
    clearInterval(timers.pop());
  }
}

module.exports = {
  JOB_KEYS,
  INTERVALS_MS,
  runLockedJob,
  startBackgroundJobs,
  stopBackgroundJobs,
};
