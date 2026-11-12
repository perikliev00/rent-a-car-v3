// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'os' module as os.
const os = require('os');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const { Readable } = require('stream');

// Call jest.mock to perform this step.
jest.mock('@aws-sdk/client-s3', () => {
  // Create the send constant.
  const send = jest.fn();
  // Return the resulting value to the caller.
  return {
    // Provide the s3 client field value.
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    // Provide the put object command field value.
    PutObjectCommand: jest.fn((input) => ({ type: 'PutObject', input })),
    // Provide the get object command field value.
    GetObjectCommand: jest.fn((input) => ({ type: 'GetObject', input })),
    // Provide the head object command field value.
    HeadObjectCommand: jest.fn((input) => ({ type: 'HeadObject', input })),
    // Provide the delete object command field value.
    DeleteObjectCommand: jest.fn((input) => ({ type: 'DeleteObject', input })),
    // Provide the mock field value.
    __mock: { send },
  };
});

// Require the '@aws-sdk/client-s3' module as s3.
const s3 = require('@aws-sdk/client-s3');
// Create the mock send constant.
const mockSend = s3.__mock.send;
// Require the '../../../src/services/storage/privateS3StorageService' module as privateS3.
const privateS3 = require('../../../src/services/storage/privateS3StorageService');

// Declare a test suite grouping related cases.
describe('privateS3StorageService', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Update process.env.PRIVATE_S3_BUCKET with the right-hand side value.
    process.env.PRIVATE_S3_BUCKET = 'luxride-private-docs';
    // Delete the specified property from the object.
    delete process.env.PRIVATE_S3_KEY_PREFIX;
  });

  // Define a single test case and its expectations.
  test('uploads a temp file with SSE-S3 and no public cache headers', async () => {
    // Create the dir constant.
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'private-s3-'));
    // Create the temp path constant.
    const tempPath = path.join(dir, 'license.png');
    // Wait until the asynchronous operation resolves.
    await fs.promises.writeFile(tempPath, Buffer.from('id-doc'));
    // Call mockSend.mockResolvedValueOnce to perform this step.
    mockSend.mockResolvedValueOnce({});

    // Create the stored constant.
    const stored = await privateS3.storePrivateFile({
      // Contribute this line to the enclosing declaration or statement.
      tempPath,
      // Provide the original name field value.
      originalName: 'license.PNG',
      // Provide the category field value.
      category: 'customer-docs',
      // Provide the mime type field value.
      mimeType: 'image/png',
    });

    // Assert that the value matches the intended expectation.
    expect(stored.storageKey).toMatch(/^private\/customer-docs\/\d+-[a-f0-9]+\.png$/);
    // Assert that the value matches the intended expectation.
    expect(stored.mimeType).toBe('image/png');
    // Assert that the value matches the intended expectation.
    expect(stored.sizeBytes).toBe(6);
    // Assert that the value matches the intended expectation.
    expect(fs.existsSync(tempPath)).toBe(false);

    // Assert that the value matches the intended expectation.
    expect(s3.PutObjectCommand).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the bucket field value.
        Bucket: 'luxride-private-docs',
        // Provide the key field value.
        Key: stored.storageKey,
        // Provide the content type field value.
        ContentType: 'image/png',
        // Provide the server side encryption field value.
        ServerSideEncryption: 'AES256',
        // Provide the cache control field value.
        CacheControl: 'private, no-store',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(s3.PutObjectCommand.mock.calls[0][0]).not.toHaveProperty('ACL');

    // Wait until the asynchronous operation resolves.
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  // Define a single test case and its expectations.
  test('uploads a buffer under the configured key prefix', async () => {
    // Update process.env.PRIVATE_S3_KEY_PREFIX with the right-hand side value.
    process.env.PRIVATE_S3_KEY_PREFIX = 'tenant-a';
    // Call mockSend.mockResolvedValueOnce to perform this step.
    mockSend.mockResolvedValueOnce({});

    // Create the stored constant.
    const stored = await privateS3.storePrivateBuffer({
      // Provide the buffer field value.
      buffer: Buffer.from('sig'),
      // Provide the original name field value.
      originalName: 'customer-sig.png',
      // Provide the category field value.
      category: 'signatures',
      // Provide the mime type field value.
      mimeType: 'image/png',
    });

    // Assert that the value matches the intended expectation.
    expect(s3.PutObjectCommand).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the key field value.
        Key: `tenant-a/${stored.storageKey}`,
        // Provide the server side encryption field value.
        ServerSideEncryption: 'AES256',
      })
    );
  });

  // Define a single test case and its expectations.
  test('openPrivateReadStream returns the S3 body stream', async () => {
    // Create the body constant.
    const body = Readable.from(['doc-bytes']);
    // Call mockSend.mockResolvedValueOnce to perform this step.
    mockSend.mockResolvedValueOnce({ Body: body });

    // Create the opened constant.
    const opened = await privateS3.openPrivateReadStream('private/customer-docs/abc.bin');

    // Assert that the value matches the intended expectation.
    expect(opened.stream).toBe(body);
    // Assert that the value matches the intended expectation.
    expect(s3.GetObjectCommand).toHaveBeenCalledWith({
      // Provide the bucket field value.
      Bucket: 'luxride-private-docs',
      // Provide the key field value.
      Key: 'private/customer-docs/abc.bin',
    });
  });

  // Define a single test case and its expectations.
  test('openPrivateReadStream returns null for missing objects', async () => {
    // Create the err constant.
    const err = new Error('missing');
    // Update err.name with the right-hand side value.
    err.name = 'NoSuchKey';
    // Update err.$metadata with the right-hand side value.
    err.$metadata = { httpStatusCode: 404 };
    // Call mockSend.mockRejectedValueOnce to perform this step.
    mockSend.mockRejectedValueOnce(err);

    // Wait until the asynchronous operation resolves.
    await expect(privateS3.openPrivateReadStream('private/customer-docs/gone.bin')).resolves.toBeNull();
  });

  // Define a single test case and its expectations.
  test('rejects path-traversal storage keys', async () => {
    // Wait until the asynchronous operation resolves.
    await expect(privateS3.openPrivateReadStream('private/../secret.bin')).resolves.toBeNull();
    // Wait until the asynchronous operation resolves.
    await expect(privateS3.deletePrivateFile('private/../secret.bin')).resolves.toBe(false);
    // Wait until the asynchronous operation resolves.
    await expect(privateS3.privateFileExists('not-private/doc.bin')).resolves.toBe(false);
    // Assert that the value matches the intended expectation.
    expect(mockSend).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('deletePrivateFile and privateFileExists use Head/Delete', async () => {
    // Call mockSend.mockResolvedValue to perform this step.
    mockSend.mockResolvedValue({});

    // Wait until the asynchronous operation resolves.
    await expect(privateS3.privateFileExists('private/checklists/a.jpg')).resolves.toBe(true);
    // Wait until the asynchronous operation resolves.
    await expect(privateS3.deletePrivateFile('private/checklists/a.jpg')).resolves.toBe(true);

    // Assert that the value matches the intended expectation.
    expect(s3.HeadObjectCommand).toHaveBeenCalledWith({
      // Provide the bucket field value.
      Bucket: 'luxride-private-docs',
      // Provide the key field value.
      Key: 'private/checklists/a.jpg',
    });
    // Assert that the value matches the intended expectation.
    expect(s3.DeleteObjectCommand).toHaveBeenCalledWith({
      // Provide the bucket field value.
      Bucket: 'luxride-private-docs',
      // Provide the key field value.
      Key: 'private/checklists/a.jpg',
    });
  });

  // Define a single test case and its expectations.
  test('privateFileExists returns false when the object is missing', async () => {
    // Create the err constant.
    const err = new Error('missing');
    // Update err.name with the right-hand side value.
    err.name = 'NotFound';
    // Update err.$metadata with the right-hand side value.
    err.$metadata = { httpStatusCode: 404 };
    // Call mockSend.mockRejectedValueOnce to perform this step.
    mockSend.mockRejectedValueOnce(err);

    // Wait until the asynchronous operation resolves.
    await expect(privateS3.privateFileExists('private/checklists/missing.jpg')).resolves.toBe(false);
  });
});
