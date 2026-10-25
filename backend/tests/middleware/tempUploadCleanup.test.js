const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../src/services/storage', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const tempDir = path.join(os.tmpdir(), `luxride-upload-${process.pid}`);
  return {
    UPLOAD_TEMP_DIR: tempDir,
    ensureTempDir: async () => {
      await fs.promises.mkdir(tempDir, { recursive: true });
    },
    deleteByPath: async (filePath) => {
      await fs.promises.unlink(filePath).catch(() => {});
    },
  };
});

const storage = require('../../src/services/storage');
const {
  discardTempUploads,
  releaseTempUploadsOnEarlyExit,
} = require('../../src/middleware/fileUpload/cleanupTempUploads');

describe('temporary upload cleanup', () => {
  beforeEach(async () => {
    await fs.promises.mkdir(storage.UPLOAD_TEMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(storage.UPLOAD_TEMP_DIR, { recursive: true, force: true });
  });

  test('discardTempUploads removes only files inside the temp directory', async () => {
    const kept = path.join(os.tmpdir(), `luxride-kept-${process.pid}.bin`);
    const tempFile = path.join(storage.UPLOAD_TEMP_DIR, 'rejected.bin');
    await fs.promises.writeFile(tempFile, 'temp');
    await fs.promises.writeFile(kept, 'kept');

    await discardTempUploads({
      file: { path: tempFile },
      files: [{ path: kept }],
    });

    await expect(fs.promises.access(tempFile)).rejects.toThrow();
    await expect(fs.promises.access(kept)).resolves.toBeUndefined();
    await fs.promises.unlink(kept);
  });

  test('an aborted response removes the temp file', async () => {
    const tempFile = path.join(storage.UPLOAD_TEMP_DIR, 'aborted.bin');
    await fs.promises.writeFile(tempFile, 'temp');
    const req = { file: { path: tempFile } };
    const res = new EventEmitter();
    res.statusCode = 499;
    res.writableEnded = false;
    releaseTempUploadsOnEarlyExit(req, res, () => {});
    res.emit('close');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(fs.promises.access(tempFile)).rejects.toThrow();
  });
});
