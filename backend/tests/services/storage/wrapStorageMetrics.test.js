// Call jest.mock to perform this step.
jest.mock('../../../src/monitoring/metrics', () => ({
  // Provide the increment storage errors field value.
  incrementStorageErrors: jest.fn(),
}));

// Require the '../../../src/monitoring/metrics' module as metrics.
const metrics = require('../../../src/monitoring/metrics');
// Destructure object properties into local variables.
const { wrapStorageMetrics } = require('../../../src/services/storage/wrapStorageMetrics');

// Declare a test suite grouping related cases.
describe('wrapStorageMetrics', () => {
  // Define a single test case and its expectations.
  test('increments storage_errors_total when wrapped write fails', async () => {
    // Create the impl constant.
    const impl = {
      // Provide the driver field value.
      driver: 'local',
      // Continue the surrounding logic with this statement.
      async storePrivateFile() {
        // Throw an error to stop the current control flow.
        throw new Error('ENOSPC');
      },
      // Provide the sync value field value.
      syncValue: 1,
    };

    // Create the wrapped constant.
    const wrapped = wrapStorageMetrics(impl);
    // Wait until the asynchronous operation resolves.
    await expect(wrapped.storePrivateFile({})).rejects.toThrow('ENOSPC');
    // Assert that the value matches the intended expectation.
    expect(metrics.incrementStorageErrors).toHaveBeenCalledWith('local', 'write');
    // Assert that the value matches the intended expectation.
    expect(wrapped.syncValue).toBe(1);
  });
});
