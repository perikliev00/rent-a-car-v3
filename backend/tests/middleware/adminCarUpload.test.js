// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'os' module as os.
const os = require('os');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const { validateUploadedImage } = require('../../src/middleware/fileUpload/validateUploadedImage');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  isAllowedImageExtension,
  // Contribute this line to the enclosing declaration or statement.
  isAllowedImageMimetype,
  // Contribute this line to the enclosing declaration or statement.
  matchesImageMagic,
// Continue the surrounding logic with this statement.
} = require('../../src/middleware/fileUpload/uploadUtils');

// Call jest.mock to perform this step.
jest.mock('../../src/services/storage', () => ({
  // Provide the process uploaded file field value.
  processUploadedFile: jest.fn(async (file) => ({
    // Provide the filename field value.
    filename: file.tempFilename,
    // Provide the path field value.
    path: file.tempPath,
    // Provide the mimetype field value.
    mimetype: 'image/jpeg',
    // Provide the public url field value.
    publicUrl: '/images/test.jpg',
  })),
  // Provide the delete by path field value.
  deleteByPath: jest.fn().mockResolvedValue(undefined),
}));

// Declare a test suite grouping related cases.
describe('uploadUtils image helpers', () => {
  // Define a single test case and its expectations.
  test('accepts allowed jpeg extension and mimetype', () => {
    // Assert that the value matches the intended expectation.
    expect(isAllowedImageExtension('.jpg')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isAllowedImageMimetype('.jpg', 'image/jpeg')).toBe(true);
  });

  // Define a single test case and its expectations.
  test('rejects unsupported extension', () => {
    // Assert that the value matches the intended expectation.
    expect(isAllowedImageExtension('.gif')).toBe(false);
  });

  // Define a single test case and its expectations.
  test('detects jpeg magic bytes', () => {
    // Create the buffer constant.
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    // Assert that the value matches the intended expectation.
    expect(matchesImageMagic(buffer, '.jpg')).toBe(true);
  });
});

// Declare a test suite grouping related cases.
describe('validateUploadedImage', () => {
  // Reserve the temp dir variable for later assignment.
  let tempDir;

  // Register setup that runs before the tests.
  beforeAll(() => {
    // Update tempDir with the right-hand side value.
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luxride-upload-'));
  });

  // Register cleanup that runs after the tests.
  afterAll(() => {
    // Call fs.rmSync to perform this step.
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Define the createMockRes function.
  function createMockRes() {
    // Return the resulting value to the caller.
    return {
      // Provide the status code field value.
      statusCode: 200,
      // Call status to perform this step.
      status(code) {
        // Update this.statusCode with the right-hand side value.
        this.statusCode = code;
        // Return the resulting value to the caller.
        return this;
      },
      // Provide the json field value.
      json: jest.fn(),
    };
  }

  // Define a single test case and its expectations.
  test('passes through when no file is uploaded', async () => {
    // Create the req constant.
    const req = {};
    // Create the next constant.
    const next = jest.fn();

    // Wait until the asynchronous operation resolves.
    await validateUploadedImage(req, createMockRes(), next);

    // Assert that the value matches the intended expectation.
    expect(next).toHaveBeenCalledWith();
    // Assert that the value matches the intended expectation.
    expect(req.fileValidationError).toBeUndefined();
  });

  // Define a single test case and its expectations.
  test('rejects invalid mime type', async () => {
    // Create the file path constant.
    const filePath = path.join(tempDir, 'bad.txt');
    // Call fs.writeFileSync to perform this step.
    fs.writeFileSync(filePath, 'not an image');
    // Create the req constant.
    const req = {
      // Provide the file field value.
      file: {
        // Provide the path field value.
        path: filePath,
        // Provide the filename field value.
        filename: 'bad.txt',
        // Provide the originalname field value.
        originalname: 'bad.txt',
        // Provide the mimetype field value.
        mimetype: 'text/plain',
      },
    };
    // Create the next constant.
    const next = jest.fn();

    // Wait until the asynchronous operation resolves.
    await validateUploadedImage(req, createMockRes(), next);

    // Assert that the value matches the intended expectation.
    expect(req.fileValidationError).toContain('Only image files are allowed');
    // Assert that the value matches the intended expectation.
    expect(next).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('accepts valid jpeg file', async () => {
    // Create the file path constant.
    const filePath = path.join(tempDir, 'valid.jpg');
    // Call fs.writeFileSync to perform this step.
    fs.writeFileSync(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]));
    // Create the req constant.
    const req = {
      // Provide the file field value.
      file: {
        // Provide the path field value.
        path: filePath,
        // Provide the filename field value.
        filename: 'valid.jpg',
        // Provide the originalname field value.
        originalname: 'valid.jpg',
        // Provide the mimetype field value.
        mimetype: 'image/jpeg',
      },
    };
    // Create the next constant.
    const next = jest.fn();

    // Wait until the asynchronous operation resolves.
    await validateUploadedImage(req, createMockRes(), next);

    // Assert that the value matches the intended expectation.
    expect(req.fileValidationError).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(next).toHaveBeenCalledWith();
  });
});
