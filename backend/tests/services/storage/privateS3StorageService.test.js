const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: jest.fn((input) => ({ type: 'PutObject', input })),
    GetObjectCommand: jest.fn((input) => ({ type: 'GetObject', input })),
    HeadObjectCommand: jest.fn((input) => ({ type: 'HeadObject', input })),
    DeleteObjectCommand: jest.fn((input) => ({ type: 'DeleteObject', input })),
    __mock: { send },
  };
});

const s3 = require('@aws-sdk/client-s3');
const mockSend = s3.__mock.send;
const privateS3 = require('../../../src/services/storage/privateS3StorageService');

describe('privateS3StorageService', () => {
  beforeEach(() => {
    process.env.PRIVATE_S3_BUCKET = 'luxride-private-docs';
    delete process.env.PRIVATE_S3_KEY_PREFIX;
  });

  test('uploads a temp file with SSE-S3 and no public cache headers', async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'private-s3-'));
    const tempPath = path.join(dir, 'license.png');
    await fs.promises.writeFile(tempPath, Buffer.from('id-doc'));
    mockSend.mockResolvedValueOnce({});

    const stored = await privateS3.storePrivateFile({
      tempPath,
      originalName: 'license.PNG',
      category: 'customer-docs',
      mimeType: 'image/png',
    });

    expect(stored.storageKey).toMatch(/^private\/customer-docs\/\d+-[a-f0-9]+\.png$/);
    expect(stored.mimeType).toBe('image/png');
    expect(stored.sizeBytes).toBe(6);
    expect(fs.existsSync(tempPath)).toBe(false);

    expect(s3.PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'luxride-private-docs',
        Key: stored.storageKey,
        ContentType: 'image/png',
        ServerSideEncryption: 'AES256',
        CacheControl: 'private, no-store',
      })
    );
    expect(s3.PutObjectCommand.mock.calls[0][0]).not.toHaveProperty('ACL');

    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  test('uploads a buffer under the configured key prefix', async () => {
    process.env.PRIVATE_S3_KEY_PREFIX = 'tenant-a';
    mockSend.mockResolvedValueOnce({});

    const stored = await privateS3.storePrivateBuffer({
      buffer: Buffer.from('sig'),
      originalName: 'customer-sig.png',
      category: 'signatures',
      mimeType: 'image/png',
    });

    expect(s3.PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: `tenant-a/${stored.storageKey}`,
        ServerSideEncryption: 'AES256',
      })
    );
  });

  test('openPrivateReadStream returns the S3 body stream', async () => {
    const body = Readable.from(['doc-bytes']);
    mockSend.mockResolvedValueOnce({ Body: body });

    const opened = await privateS3.openPrivateReadStream('private/customer-docs/abc.bin');

    expect(opened.stream).toBe(body);
    expect(s3.GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'luxride-private-docs',
      Key: 'private/customer-docs/abc.bin',
    });
  });

  test('openPrivateReadStream returns null for missing objects', async () => {
    const err = new Error('missing');
    err.name = 'NoSuchKey';
    err.$metadata = { httpStatusCode: 404 };
    mockSend.mockRejectedValueOnce(err);

    await expect(privateS3.openPrivateReadStream('private/customer-docs/gone.bin')).resolves.toBeNull();
  });

  test('rejects path-traversal storage keys', async () => {
    await expect(privateS3.openPrivateReadStream('private/../secret.bin')).resolves.toBeNull();
    await expect(privateS3.deletePrivateFile('private/../secret.bin')).resolves.toBe(false);
    await expect(privateS3.privateFileExists('not-private/doc.bin')).resolves.toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('deletePrivateFile and privateFileExists use Head/Delete', async () => {
    mockSend.mockResolvedValue({});

    await expect(privateS3.privateFileExists('private/checklists/a.jpg')).resolves.toBe(true);
    await expect(privateS3.deletePrivateFile('private/checklists/a.jpg')).resolves.toBe(true);

    expect(s3.HeadObjectCommand).toHaveBeenCalledWith({
      Bucket: 'luxride-private-docs',
      Key: 'private/checklists/a.jpg',
    });
    expect(s3.DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'luxride-private-docs',
      Key: 'private/checklists/a.jpg',
    });
  });

  test('privateFileExists returns false when the object is missing', async () => {
    const err = new Error('missing');
    err.name = 'NotFound';
    err.$metadata = { httpStatusCode: 404 };
    mockSend.mockRejectedValueOnce(err);

    await expect(privateS3.privateFileExists('private/checklists/missing.jpg')).resolves.toBe(false);
  });
});
