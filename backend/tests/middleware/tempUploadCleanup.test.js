// Destructure object properties into local variables.
const { EventEmitter } = require('events');
// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'os' module as os.
const os = require('os');
// Require the 'path' module as path.
const path = require('path');

// Call jest.mock to perform this step.
jest.mock('../../src/services/storage', () => {
  // Require the 'fs' module as fs.
  const fs = require('fs');
  // Require the 'os' module as os.
  const os = require('os');
  // Require the 'path' module as path.
  const path = require('path');
  // Create the temp dir constant.
  const tempDir = path.join(os.tmpdir(), `luxride-upload-${process.pid}`);
  // Return the resulting value to the caller.
  return {
    // Provide the upload temp dir field value.
    UPLOAD_TEMP_DIR: tempDir,
    // Provide the ensure temp dir field value.
    ensureTempDir: async () => {
      // Wait until the asynchronous operation resolves.
      await fs.promises.mkdir(tempDir, { recursive: true });
    },
    // Provide the delete by path field value.
    deleteByPath: async (filePath) => {
      // Wait until the asynchronous operation resolves.
      await fs.promises.unlink(filePath).catch(() => {});
    },
  };
});

// Require the '../../src/services/storage' module as storage.
const storage = require('../../src/services/storage');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  discardTempUploads,
  // Contribute this line to the enclosing declaration or statement.
  releaseTempUploadsOnEarlyExit,
// Continue the surrounding logic with this statement.
} = require('../../src/middleware/fileUpload/cleanupTempUploads');

// Declare a test suite grouping related cases.
describe('temporary upload cleanup', () => {
  // Register setup that runs before the tests.
  beforeEach(async () => {
    // Wait until the asynchronous operation resolves.
    await fs.promises.mkdir(storage.UPLOAD_TEMP_DIR, { recursive: true });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await fs.promises.rm(storage.UPLOAD_TEMP_DIR, { recursive: true, force: true });
  });

  // Define a single test case and its expectations.
  test('discardTempUploads removes only files inside the temp directory', async () => {
    // Create the kept constant.
    const kept = path.join(os.tmpdir(), `luxride-kept-${process.pid}.bin`);
    // Create the temp file constant.
    const tempFile = path.join(storage.UPLOAD_TEMP_DIR, 'rejected.bin');
    // Wait until the asynchronous operation resolves.
    await fs.promises.writeFile(tempFile, 'temp');
    // Wait until the asynchronous operation resolves.
    await fs.promises.writeFile(kept, 'kept');

    // Wait until the asynchronous operation resolves.
    await discardTempUploads({
      // Provide the file field value.
      file: { path: tempFile },
      // Provide the files field value.
      files: [{ path: kept }],
    });

    // Wait until the asynchronous operation resolves.
    await expect(fs.promises.access(tempFile)).rejects.toThrow();
    // Wait until the asynchronous operation resolves.
    await expect(fs.promises.access(kept)).resolves.toBeUndefined();
    // Wait until the asynchronous operation resolves.
    await fs.promises.unlink(kept);
  });

  // Define a single test case and its expectations.
  test('an aborted response removes the temp file', async () => {
    // Create the temp file constant.
    const tempFile = path.join(storage.UPLOAD_TEMP_DIR, 'aborted.bin');
    // Wait until the asynchronous operation resolves.
    await fs.promises.writeFile(tempFile, 'temp');
    // Create the req constant.
    const req = { file: { path: tempFile } };
    // Create the res constant.
    const res = new EventEmitter();
    // Update res.statusCode with the right-hand side value.
    res.statusCode = 499;
    // Update res.writableEnded with the right-hand side value.
    res.writableEnded = false;
    // Call releaseTempUploadsOnEarlyExit to perform this step.
    releaseTempUploadsOnEarlyExit(req, res, () => {});
    // Call res.emit to perform this step.
    res.emit('close');
    // Wait until the asynchronous operation resolves.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Wait until the asynchronous operation resolves.
    await expect(fs.promises.access(tempFile)).rejects.toThrow();
  });
});
