jest.mock('../../src/db/transaction', () => {
  const actual = jest.requireActual('../../src/db/transaction');
  return {
    ...actual,
    withJobLock: jest.fn(),
  };
});

jest.mock('../../src/services/carService', () => ({
  cleanUpOutdatedDates: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/reservationService', () => ({
  cleanUpAbandonedReservations: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/storage/imageCleanupService', () => ({
  cleanupCarImages: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/carFleetAlertReconcileService', () => ({
  runFleetAlertChecks: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/modules/notifications/notifications.scheduler', () => ({
  runNotificationScheduler: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/modules/notifications/notifications.worker', () => ({
  processDueNotifications: jest.fn().mockResolvedValue({ processed: 0 }),
}));

const { withJobLock } = require('../../src/db/transaction');
const { cleanUpOutdatedDates } = require('../../src/services/carService');
const {
  JOB_KEYS,
  runLockedJob,
  startBackgroundJobs,
  stopBackgroundJobs,
} = require('../../src/jobs/backgroundJobRunner');

describe('backgroundJobRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stopBackgroundJobs();
  });

  afterEach(() => {
    stopBackgroundJobs();
  });

  test('runLockedJob skips work body when lock is busy', async () => {
    withJobLock.mockResolvedValue({ skipped: true });
    const work = jest.fn();

    await expect(runLockedJob(JOB_KEYS.OUTDATED_DATES, work)).resolves.toEqual({ skipped: true });
    expect(withJobLock).toHaveBeenCalledWith(JOB_KEYS.OUTDATED_DATES, expect.any(Function));
    expect(work).not.toHaveBeenCalled();
  });

  test('runLockedJob invokes work when lock is acquired', async () => {
    withJobLock.mockImplementation(async (_key, work) => {
      const result = await work();
      return { skipped: false, result };
    });
    const work = jest.fn().mockResolvedValue('ok');

    await expect(runLockedJob(JOB_KEYS.FLEET_ALERTS, work)).resolves.toEqual({
      skipped: false,
      result: 'ok',
    });
    expect(work).toHaveBeenCalledTimes(1);
  });

  test('startBackgroundJobs runs locked jobs immediately then registers intervals', async () => {
    withJobLock.mockImplementation(async (_key, work) => {
      const result = await work();
      return { skipped: false, result };
    });

    await startBackgroundJobs({ pool: { query: jest.fn() } });

    expect(cleanUpOutdatedDates).toHaveBeenCalled();
    expect(withJobLock).toHaveBeenCalledWith(JOB_KEYS.OUTDATED_DATES, expect.any(Function));
    expect(withJobLock).toHaveBeenCalledWith(
      JOB_KEYS.NOTIFICATIONS_WORKER,
      expect.any(Function)
    );

    stopBackgroundJobs();
  });
});
