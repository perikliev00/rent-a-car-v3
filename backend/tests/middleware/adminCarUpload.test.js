const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateUploadedImage } = require('../../src/middleware/fileUpload/validateUploadedImage');
const {
  isAllowedImageExtension,
  isAllowedImageMimetype,
  matchesImageMagic,
} = require('../../src/middleware/fileUpload/uploadUtils');

jest.mock('../../src/services/storage', () => ({
  processUploadedFile: jest.fn(async (file) => ({
    filename: file.tempFilename,
    path: file.tempPath,
    mimetype: 'image/jpeg',
    publicUrl: '/images/test.jpg',
  })),
  deleteByPath: jest.fn().mockResolvedValue(undefined),
}));

describe('uploadUtils image helpers', () => {
  test('accepts allowed jpeg extension and mimetype', () => {
    expect(isAllowedImageExtension('.jpg')).toBe(true);
    expect(isAllowedImageMimetype('.jpg', 'image/jpeg')).toBe(true);
  });

  test('rejects unsupported extension', () => {
    expect(isAllowedImageExtension('.gif')).toBe(false);
  });

  test('detects jpeg magic bytes', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    expect(matchesImageMagic(buffer, '.jpg')).toBe(true);
  });
});

describe('validateUploadedImage', () => {
  let tempDir;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luxride-upload-'));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createMockRes() {
    return {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json: jest.fn(),
    };
  }

  test('passes through when no file is uploaded', async () => {
    const req = {};
    const next = jest.fn();

    await validateUploadedImage(req, createMockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.fileValidationError).toBeUndefined();
  });

  test('rejects invalid mime type', async () => {
    const filePath = path.join(tempDir, 'bad.txt');
    fs.writeFileSync(filePath, 'not an image');
    const req = {
      file: {
        path: filePath,
        filename: 'bad.txt',
        originalname: 'bad.txt',
        mimetype: 'text/plain',
      },
    };
    const next = jest.fn();

    await validateUploadedImage(req, createMockRes(), next);

    expect(req.fileValidationError).toContain('Only image files are allowed');
    expect(next).toHaveBeenCalled();
  });

  test('accepts valid jpeg file', async () => {
    const filePath = path.join(tempDir, 'valid.jpg');
    fs.writeFileSync(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]));
    const req = {
      file: {
        path: filePath,
        filename: 'valid.jpg',
        originalname: 'valid.jpg',
        mimetype: 'image/jpeg',
      },
    };
    const next = jest.fn();

    await validateUploadedImage(req, createMockRes(), next);

    expect(req.fileValidationError).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });
});
