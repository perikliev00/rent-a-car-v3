const logger = require('../utils/logger');
const { withJobLock } = require('../db/transaction');
const { cleanUpOutdatedDates } = require('../services/carService');
const { cleanUpAbandonedReservations } = require('../services/reservationService');
const { cleanupCarImages } = require('../services/storage/imageCleanupService');
const { runFleetAlertChecks } = require('../services/carFleetAlertReconcileService');
const { runNotificationScheduler } = require('../modules/notifications/notifications.scheduler');
const { processDueNotifications } = require('../modules/notifications/notifications.worker');

const JOB_KEYS = Object.freeze({
  OUTDATED_DATES: 'cleanup.outdated_dates',
  ABANDONED_RESERVATIONS: 'cleanup.abandoned_reservations',
  CAR_IMAGES: 'cleanup.car_images',
  FLEET_ALERTS: 'fleet.alerts',
  NOTIFICATIONS_SCHEDULER: 'notifications.scheduler',
  NOTIFICATIONS_WORKER: 'notifications.worker',
});

const INTERVALS_MS = Object.freeze({
  OUTDATED_DATES: 3 * 60 * 1000,
  ABANDONED_RESERVATIONS: 3 * 60 * 1000,
  CAR_IMAGES: 6 * 60 * 60 * 1000,
  FLEET_ALERTS: 3 * 60 * 1000,
  NOTIFICATIONS_SCHEDULER: 10 * 60 * 1000,
  NOTIFICATIONS_WORKER: 2 * 60 * 1000,
});

const timers = [];

async function runLockedJob(jobKey, work) {
  try {
    const outcome = await withJobLock(jobKey, async () => work());
    if (outcome?.skipped) {
      logger.debug({ jobKey }, 'Background job skipped (lock held)');
    }
    return outcome;
  } catch (err) {
    logger.error({ err, jobKey }, 'Background job error');
    return { skipped: false, error: err };
  }
}

function registerInterval(fn, intervalMs) {
  const timer = setInterval(fn, intervalMs);
  timers.push(timer);
  return timer;
}

async function startBackgroundJobs({ pool } = {}) {
  // pool is accepted for API symmetry / future jobs; business jobs use module pools.
  void pool;

  await runLockedJob(JOB_KEYS.OUTDATED_DATES, cleanUpOutdatedDates);
  await runLockedJob(JOB_KEYS.ABANDONED_RESERVATIONS, cleanUpAbandonedReservations);
  await runLockedJob(JOB_KEYS.CAR_IMAGES, cleanupCarImages);
  await runLockedJob(JOB_KEYS.FLEET_ALERTS, runFleetAlertChecks);
  await runLockedJob(JOB_KEYS.NOTIFICATIONS_SCHEDULER, runNotificationScheduler);
  await runLockedJob(JOB_KEYS.NOTIFICATIONS_WORKER, () => processDueNotifications({ limit: 50 }));

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

function stopBackgroundJobs() {
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
