const fs = require('fs');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { KEY_PREFIX, generatePrivateKey, isValidPrivateStorageKey } = require('./privateStorageKeys');

function getConfig() {
  const bucket = process.env.PRIVATE_S3_BUCKET;
  if (!bucket) {
    throw new Error('PRIVATE_S3_BUCKET is required when PRIVATE_STORAGE_DRIVER=s3.');
  }

  const keyPrefix = process.env.PRIVATE_S3_KEY_PREFIX || '';
  return {
    bucket,
    keyPrefix: keyPrefix && !keyPrefix.endsWith('/') ? `${keyPrefix}/` : keyPrefix,
  };
}

function createS3Client() {
  const region = process.env.S3_REGION || 'auto';
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const credentials =
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      : undefined;

  return new S3Client({
    region,
    endpoint,
    credentials,
    forcePathStyle: Boolean(process.env.S3_FORCE_PATH_STYLE),
  });
}

function buildObjectKey(storageKey) {
  if (!isValidPrivateStorageKey(storageKey)) {
    return null;
  }
  const { keyPrefix } = getConfig();
  return `${keyPrefix}${storageKey}`;
}

function isNotFoundError(err) {
  const status = err?.$metadata?.httpStatusCode;
  return err?.name === 'NotFound' || err?.name === 'NoSuchKey' || status === 404;
}

async function putPrivateObject({ storageKey, body, mimeType, sizeBytes }) {
  const objectKey = buildObjectKey(storageKey);
  if (!objectKey) {
    throw new Error('Invalid private storage key.');
  }

  const { bucket } = getConfig();
  const client = createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: mimeType || 'application/octet-stream',
      ServerSideEncryption: 'AES256',
      CacheControl: 'private, no-store',
    })
  );

  return {
    storageKey,
    mimeType: mimeType || 'application/octet-stream',
    sizeBytes,
  };
}

async function storePrivateFile({ tempPath, originalName, category = 'doc', mimeType }) {
  if (!tempPath) {
    throw new Error('Missing temp upload path.');
  }

  const storageKey = generatePrivateKey(originalName, category);
  const body = await fs.promises.readFile(tempPath);
  const stored = await putPrivateObject({
    storageKey,
    body,
    mimeType,
    sizeBytes: body.length,
  });
  await fs.promises.unlink(tempPath).catch(() => {});
  return stored;
}

async function storePrivateBuffer({ buffer, originalName, category = 'doc', mimeType }) {
  const storageKey = generatePrivateKey(originalName, category);
  return putPrivateObject({
    storageKey,
    body: buffer,
    mimeType,
    sizeBytes: buffer.length,
  });
}

async function openPrivateReadStream(storageKey) {
  const objectKey = buildObjectKey(storageKey);
  if (!objectKey) {
    return null;
  }

  const { bucket } = getConfig();
  const client = createS3Client();
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );
    if (!response.Body) {
      return null;
    }
    return { stream: response.Body };
  } catch (err) {
    if (isNotFoundError(err)) {
      return null;
    }
    throw err;
  }
}

async function deletePrivateFile(storageKey) {
  const objectKey = buildObjectKey(storageKey);
  if (!objectKey) return false;

  const { bucket } = getConfig();
  const client = createS3Client();
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );
    return true;
  } catch (err) {
    if (isNotFoundError(err)) {
      return false;
    }
    throw err;
  }
}

async function privateFileExists(storageKey) {
  const objectKey = buildObjectKey(storageKey);
  if (!objectKey) return false;

  const { bucket } = getConfig();
  const client = createS3Client();
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );
    return true;
  } catch (err) {
    if (isNotFoundError(err)) {
      return false;
    }
    throw err;
  }
}

async function ensurePrivateDir() {
  // No local directory for S3-backed private storage.
}

module.exports = {
  driver: 's3',
  KEY_PREFIX,
  generatePrivateKey,
  ensurePrivateDir,
  storePrivateFile,
  storePrivateBuffer,
  openPrivateReadStream,
  deletePrivateFile,
  privateFileExists,
};
