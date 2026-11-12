// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Require the 'os' module as os.
const os = require('os');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  collectStoragePathSizes,
  // Contribute this line to the enclosing declaration or statement.
  parseExtraDiskMonitorPaths,
// Continue the surrounding logic with this statement.
} = require('../../src/monitoring/gaugePoller');

// Declare a test suite grouping related cases.
describe('gaugePoller disk helpers', () => {
  // Create the previous disk paths constant.
  const previousDiskPaths = process.env.DISK_MONITOR_PATHS;

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (previousDiskPaths === undefined) {
      // Delete the specified property from the object.
      delete process.env.DISK_MONITOR_PATHS;
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Update process.env.DISK_MONITOR_PATHS with the right-hand side value.
      process.env.DISK_MONITOR_PATHS = previousDiskPaths;
    }
  });

  // Define a single test case and its expectations.
  test('parseExtraDiskMonitorPaths reads label=path pairs', () => {
    // Update process.env.DISK_MONITOR_PATHS with the right-hand side value.
    process.env.DISK_MONITOR_PATHS = 'custom=/tmp/a, other=/tmp/b';
    // Assert that the value matches the intended expectation.
    expect(parseExtraDiskMonitorPaths()).toEqual([
      // Contribute this line to the enclosing declaration or statement.
      { label: 'custom', path: '/tmp/a' },
      // Contribute this line to the enclosing declaration or statement.
      { label: 'other', path: '/tmp/b' },
    ]);
  });

  // Define a single test case and its expectations.
  test('collectStoragePathSizes skips missing read-only paths without mkdir', async () => {
    // Create the missing constant.
    const missing = path.join(os.tmpdir(), `luxride-missing-${Date.now()}`);
    // Create the result constant.
    const result = await collectStoragePathSizes(missing, 'postgres_data', {
      // Provide the ensure dir field value.
      ensureDir: false,
    });
    // Assert that the value matches the intended expectation.
    expect(result).toBeNull();
    // Wait until the asynchronous operation resolves.
    await expect(fs.promises.access(missing)).rejects.toBeTruthy();
  });

  // Define a single test case and its expectations.
  test('collectStoragePathSizes can ensure writable dirs', async () => {
    // Create the dir constant.
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'luxride-disk-'));
    // Create the nested constant.
    const nested = path.join(dir, 'uploads');
    // Create the result constant.
    const result = await collectStoragePathSizes(nested, 'private_uploads', {
      // Provide the ensure dir field value.
      ensureDir: true,
    });

    // Assert that the value matches the intended expectation.
    expect(result).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the label field value.
        label: 'private_uploads',
        // Provide the free bytes field value.
        freeBytes: expect.any(Number),
        // Provide the size bytes field value.
        sizeBytes: expect.any(Number),
      })
    );
    // Wait until the asynchronous operation resolves.
    await fs.promises.rm(dir, { recursive: true, force: true });
  });
});
