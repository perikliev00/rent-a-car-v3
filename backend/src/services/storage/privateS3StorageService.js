/**
 * Private S3 driver (PRIVATE_STORAGE_DRIVER=s3) for non-public documents.
 * Objects are not given public URLs; access is via openPrivateReadStream only.
 */
const fs = require('fs');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { KEY_PREFIX, generatePrivateKey, isValidPrivateStorageKey } = require('./privateStorageKeys');

/**
 * Load config.
 * @returns {*}
 */
function getConfig() {
  const bucket = process.env.PRIVATE_S3_BUCKET;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!bucket) {
    throw new Error('PRIVATE_S3_BUCKET is required when PRIVATE_STORAGE_DRIVER=s3.');
  }

  const keyPrefix = process.env.PRIVATE_S3_KEY_PREFIX || '';
  return {
    bucket,
    keyPrefix: keyPrefix && !keyPrefix.endsWith('/') ? `${keyPrefix}/` : keyPrefix,
  };
}

/**
 * Insert s3 client and return the mapped result.
 * @returns {*}
 */
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

/**
 * Transform helper: build object key.
 * @param {string} storageKey
 * @returns {*}
 */
function buildObjectKey(storageKey) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!isValidPrivateStorageKey(storageKey)) {
    return null;
  }
  const { keyPrefix } = getConfig();
  return `${keyPrefix}${storageKey}`;
}

/**
 * Predicate helper: is not found error.
 * @param {*} err
 * @returns {*}
 */
function isNotFoundError(err) {
  const status = err?.$metadata?.httpStatusCode;
  return err?.name === 'NotFound' || err?.name === 'NoSuchKey' || status === 404;
}

/**
 * put private object.
 * @param {object} params
 * @returns {Promise<*>}
 */
async function putPrivateObject({ storageKey, body, mimeType, sizeBytes }) {
  const objectKey = buildObjectKey(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * store private file.
 * @param {object} params
 * @returns {Promise<*>}
 */
async function storePrivateFile({ tempPath, originalName, category = 'doc', mimeType }) {
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * store private buffer.
 * @param {object} params
 * @returns {Promise<*>}
 */
async function storePrivateBuffer({ buffer, originalName, category = 'doc', mimeType }) {
  const storageKey = generatePrivateKey(originalName, category);
  return putPrivateObject({
    storageKey,
    body: buffer,
    mimeType,
    sizeBytes: buffer.length,
  });
}

/**
 * open private read stream.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function openPrivateReadStream(storageKey) {
  const objectKey = buildObjectKey(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!objectKey) {
    return null;
  }

  const { bucket } = getConfig();
  const client = createS3Client();
  // Protected block: isolate failure modes.
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );
    // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * Delete private file; returns whether a row was affected.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function deletePrivateFile(storageKey) {
  const objectKey = buildObjectKey(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!objectKey) return false;

  const { bucket } = getConfig();
  const client = createS3Client();
  // Protected block: isolate failure modes.
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

/**
 * private file exists.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function privateFileExists(storageKey) {
  const objectKey = buildObjectKey(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!objectKey) return false;

  const { bucket } = getConfig();
  const client = createS3Client();
  // Protected block: isolate failure modes.
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

/**
 * Ensure private dir exists or is initialized.
 * @returns {Promise<*>}
 */
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
