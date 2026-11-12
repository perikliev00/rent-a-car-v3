jest.mock('../../../src/monitoring/metrics', () => ({
  incrementStorageErrors: jest.fn(),
}));

const metrics = require('../../../src/monitoring/metrics');
const { wrapStorageMetrics } = require('../../../src/services/storage/wrapStorageMetrics');

describe('wrapStorageMetrics', () => {
  test('increments storage_errors_total when wrapped write fails', async () => {
    const impl = {
      driver: 'local',
      async storePrivateFile() {
        throw new Error('ENOSPC');
      },
      syncValue: 1,
    };

    const wrapped = wrapStorageMetrics(impl);
    await expect(wrapped.storePrivateFile({})).rejects.toThrow('ENOSPC');
    expect(metrics.incrementStorageErrors).toHaveBeenCalledWith('local', 'write');
    expect(wrapped.syncValue).toBe(1);
  });
});
