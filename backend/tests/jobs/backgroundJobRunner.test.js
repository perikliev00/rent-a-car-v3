// Call jest.mock to perform this step.
jest.mock('../../src/db/transaction', () => {
  // Create the actual constant.
  const actual = jest.requireActual('../../src/db/transaction');
  // Return the resulting value to the caller.
  return {
    // Spread actual into the surrounding structure.
    ...actual,
    // Provide the with job lock field value.
    withJobLock: jest.fn(),
  };
});

// Call jest.mock to perform this step.
jest.mock('../../src/services/carService', () => ({
  // Provide the clean up outdated dates field value.
  cleanUpOutdatedDates: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/reservationService', () => ({
  // Provide the clean up abandoned reservations field value.
  cleanUpAbandonedReservations: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/storage/imageCleanupService', () => ({
  // Provide the cleanup car images field value.
  cleanupCarImages: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/carFleetAlertReconcileService', () => ({
  // Provide the run fleet alert checks field value.
  runFleetAlertChecks: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/modules/notifications/notifications.scheduler', () => ({
  // Provide the run notification scheduler field value.
  runNotificationScheduler: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/modules/notifications/notifications.worker', () => ({
  // Provide the process due notifications field value.
  processDueNotifications: jest.fn().mockResolvedValue({ processed: 0 }),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/monitoring/metrics', () => ({
  // Provide the increment background job failure field value.
  incrementBackgroundJobFailure: jest.fn(),
  // Provide the set background job last success field value.
  setBackgroundJobLastSuccess: jest.fn(),
}));

// Destructure object properties into local variables.
const { withJobLock } = require('../../src/db/transaction');
// Destructure object properties into local variables.
const { cleanUpOutdatedDates } = require('../../src/services/carService');
// Require the '../../src/monitoring/metrics' module as metrics.
const metrics = require('../../src/monitoring/metrics');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  JOB_KEYS,
  // Contribute this line to the enclosing declaration or statement.
  runLockedJob,
  // Contribute this line to the enclosing declaration or statement.
  startBackgroundJobs,
  // Contribute this line to the enclosing declaration or statement.
  stopBackgroundJobs,
// Continue the surrounding logic with this statement.
} = require('../../src/jobs/backgroundJobRunner');

// Declare a test suite grouping related cases.
describe('backgroundJobRunner', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call stopBackgroundJobs to perform this step.
    stopBackgroundJobs();
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Call stopBackgroundJobs to perform this step.
    stopBackgroundJobs();
  });

  // Define a single test case and its expectations.
  test('runLockedJob skips work body when lock is busy', async () => {
    // Call withJobLock.mockResolvedValue to perform this step.
    withJobLock.mockResolvedValue({ skipped: true });
    // Create the work constant.
    const work = jest.fn();

    // Wait until the asynchronous operation resolves.
    await expect(runLockedJob(JOB_KEYS.OUTDATED_DATES, work)).resolves.toEqual({ skipped: true });
    // Assert that the value matches the intended expectation.
    expect(withJobLock).toHaveBeenCalledWith(JOB_KEYS.OUTDATED_DATES, expect.any(Function));
    // Assert that the value matches the intended expectation.
    expect(work).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(metrics.setBackgroundJobLastSuccess).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('runLockedJob invokes work when lock is acquired', async () => {
    // Call withJobLock.mockImplementation to perform this step.
    withJobLock.mockImplementation(async (_key, work) => {
      // Create the result constant.
      const result = await work();
      // Return the resulting value to the caller.
      return { skipped: false, result };
    });
    // Create the work constant.
    const work = jest.fn().mockResolvedValue('ok');

    // Wait until the asynchronous operation resolves.
    await expect(runLockedJob(JOB_KEYS.FLEET_ALERTS, work)).resolves.toEqual({
      // Provide the skipped field value.
      skipped: false,
      // Provide the result field value.
      result: 'ok',
    });
    // Assert that the value matches the intended expectation.
    expect(work).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(metrics.setBackgroundJobLastSuccess).toHaveBeenCalledWith(JOB_KEYS.FLEET_ALERTS);
  });

  // Define a single test case and its expectations.
  test('runLockedJob records failure metrics when work throws', async () => {
    // Call withJobLock.mockImplementation to perform this step.
    withJobLock.mockImplementation(async (_key, work) => work());
    // Create the boom constant.
    const boom = new Error('job failed');

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call runLockedJob to perform this step.
      runLockedJob(JOB_KEYS.CAR_IMAGES, async () => {
        // Throw an error to stop the current control flow.
        throw boom;
      })
    // Continue the surrounding logic with this statement.
    ).resolves.toEqual({ skipped: false, error: boom });

    // Assert that the value matches the intended expectation.
    expect(metrics.incrementBackgroundJobFailure).toHaveBeenCalledWith(JOB_KEYS.CAR_IMAGES);
  });

  // Define a single test case and its expectations.
  test('startBackgroundJobs runs locked jobs immediately then registers intervals', async () => {
    // Call withJobLock.mockImplementation to perform this step.
    withJobLock.mockImplementation(async (_key, work) => {
      // Create the result constant.
      const result = await work();
      // Return the resulting value to the caller.
      return { skipped: false, result };
    });

    // Wait until the asynchronous operation resolves.
    await startBackgroundJobs({ pool: { query: jest.fn() } });

    // Assert that the value matches the intended expectation.
    expect(cleanUpOutdatedDates).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(withJobLock).toHaveBeenCalledWith(JOB_KEYS.OUTDATED_DATES, expect.any(Function));
    // Assert that the value matches the intended expectation.
    expect(withJobLock).toHaveBeenCalledWith(
      // Contribute this line to the enclosing declaration or statement.
      JOB_KEYS.NOTIFICATIONS_WORKER,
      // Call expect.any to perform this step.
      expect.any(Function)
    );
  });
});
