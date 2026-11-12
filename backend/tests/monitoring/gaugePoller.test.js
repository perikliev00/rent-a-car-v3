const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  collectStoragePathSizes,
  parseExtraDiskMonitorPaths,
} = require('../../src/monitoring/gaugePoller');

describe('gaugePoller disk helpers', () => {
  const previousDiskPaths = process.env.DISK_MONITOR_PATHS;

  afterEach(() => {
    if (previousDiskPaths === undefined) {
      delete process.env.DISK_MONITOR_PATHS;
    } else {
      process.env.DISK_MONITOR_PATHS = previousDiskPaths;
    }
  });

  test('parseExtraDiskMonitorPaths reads label=path pairs', () => {
    process.env.DISK_MONITOR_PATHS = 'custom=/tmp/a, other=/tmp/b';
    expect(parseExtraDiskMonitorPaths()).toEqual([
      { label: 'custom', path: '/tmp/a' },
      { label: 'other', path: '/tmp/b' },
    ]);
  });

  test('collectStoragePathSizes skips missing read-only paths without mkdir', async () => {
    const missing = path.join(os.tmpdir(), `luxride-missing-${Date.now()}`);
    const result = await collectStoragePathSizes(missing, 'postgres_data', {
      ensureDir: false,
    });
    expect(result).toBeNull();
    await expect(fs.promises.access(missing)).rejects.toBeTruthy();
  });

  test('collectStoragePathSizes can ensure writable dirs', async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'luxride-disk-'));
    const nested = path.join(dir, 'uploads');
    const result = await collectStoragePathSizes(nested, 'private_uploads', {
      ensureDir: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        label: 'private_uploads',
        freeBytes: expect.any(Number),
        sizeBytes: expect.any(Number),
      })
    );
    await fs.promises.rm(dir, { recursive: true, force: true });
  });
});
