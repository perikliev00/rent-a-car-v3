/**
 * Private S3 driver (PRIVATE_STORAGE_DRIVER=s3) for non-public documents.
 * Objects are not given public URLs; access is via openPrivateReadStream only.
 */
const fs = require('fs');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  S3Client,
  // Contribute this line to the enclosing declaration or statement.
  PutObjectCommand,
  // Contribute this line to the enclosing declaration or statement.
  GetObjectCommand,
  // Contribute this line to the enclosing declaration or statement.
  HeadObjectCommand,
  // Contribute this line to the enclosing declaration or statement.
  DeleteObjectCommand,
// Continue the surrounding logic with this statement.
} = require('@aws-sdk/client-s3');
// Destructure object properties into local variables.
const { KEY_PREFIX, generatePrivateKey, isValidPrivateStorageKey } = require('./privateStorageKeys');

/**
 * Load config.
 * @returns {*}
 */
function getConfig() {
  // Create the bucket constant.
  const bucket = process.env.PRIVATE_S3_BUCKET;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!bucket) {
    // Throw an error to stop the current control flow.
    throw new Error('PRIVATE_S3_BUCKET is required when PRIVATE_STORAGE_DRIVER=s3.');
  }

  // Create the key prefix constant.
  const keyPrefix = process.env.PRIVATE_S3_KEY_PREFIX || '';
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    bucket,
    // Provide the key prefix field value.
    keyPrefix: keyPrefix && !keyPrefix.endsWith('/') ? `${keyPrefix}/` : keyPrefix,
  };
}

/**
 * Insert s3 client and return the mapped result.
 * @returns {*}
 */
function createS3Client() {
  // Create the region constant.
  const region = process.env.S3_REGION || 'auto';
  // Create the endpoint constant.
  const endpoint = process.env.S3_ENDPOINT || undefined;
  // Create the credentials constant.
  const credentials =
    // Contribute this line to the enclosing declaration or statement.
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      // Contribute this line to the enclosing declaration or statement.
      ? {
          // Provide the access key id field value.
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          // Provide the secret access key field value.
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      // Contribute this line to the enclosing declaration or statement.
      : undefined;

  // Return the resulting value to the caller.
  return new S3Client({
    // Contribute this line to the enclosing declaration or statement.
    region,
    // Contribute this line to the enclosing declaration or statement.
    endpoint,
    // Contribute this line to the enclosing declaration or statement.
    credentials,
    // Provide the force path style field value.
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
    // Return the resulting value to the caller.
    return null;
  }
  // Destructure object properties into local variables.
  const { keyPrefix } = getConfig();
  // Return the resulting value to the caller.
  return `${keyPrefix}${storageKey}`;
}

/**
 * Predicate helper: is not found error.
 * @param {*} err
 * @returns {*}
 */
function isNotFoundError(err) {
  // Create the status constant.
  const status = err?.$metadata?.httpStatusCode;
  // Return the resulting value to the caller.
  return err?.name === 'NotFound' || err?.name === 'NoSuchKey' || status === 404;
}

/**
 * put private object.
 * @param {object} params
 * @returns {Promise<*>}
 */
async function putPrivateObject({ storageKey, body, mimeType, sizeBytes }) {
  // Create the object key constant.
  const objectKey = buildObjectKey(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!objectKey) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid private storage key.');
  }

  // Destructure object properties into local variables.
  const { bucket } = getConfig();
  // Create the client constant.
  const client = createS3Client();
  // Wait until the asynchronous operation resolves.
  await client.send(
    // Continue the surrounding logic with this statement.
    new PutObjectCommand({
      // Provide the bucket field value.
      Bucket: bucket,
      // Provide the key field value.
      Key: objectKey,
      // Provide the body field value.
      Body: body,
      // Provide the content type field value.
      ContentType: mimeType || 'application/octet-stream',
      // Provide the server side encryption field value.
      ServerSideEncryption: 'AES256',
      // Provide the cache control field value.
      CacheControl: 'private, no-store',
    })
  );

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    storageKey,
    // Provide the mime type field value.
    mimeType: mimeType || 'application/octet-stream',
    // Contribute this line to the enclosing declaration or statement.
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
    // Throw an error to stop the current control flow.
    throw new Error('Missing temp upload path.');
  }

  // Create the storage key constant.
  const storageKey = generatePrivateKey(originalName, category);
  // Create the body constant.
  const body = await fs.promises.readFile(tempPath);
  // Create the stored constant.
  const stored = await putPrivateObject({
    // Contribute this line to the enclosing declaration or statement.
    storageKey,
    // Contribute this line to the enclosing declaration or statement.
    body,
    // Contribute this line to the enclosing declaration or statement.
    mimeType,
    // Provide the size bytes field value.
    sizeBytes: body.length,
  });
  // Wait until the asynchronous operation resolves.
  await fs.promises.unlink(tempPath).catch(() => {});
  // Return the resulting value to the caller.
  return stored;
}

/**
 * store private buffer.
 * @param {object} params
 * @returns {Promise<*>}
 */
async function storePrivateBuffer({ buffer, originalName, category = 'doc', mimeType }) {
  // Create the storage key constant.
  const storageKey = generatePrivateKey(originalName, category);
  // Return the resulting value to the caller.
  return putPrivateObject({
    // Contribute this line to the enclosing declaration or statement.
    storageKey,
    // Provide the body field value.
    body: buffer,
    // Contribute this line to the enclosing declaration or statement.
    mimeType,
    // Provide the size bytes field value.
    sizeBytes: buffer.length,
  });
}

/**
 * open private read stream.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function openPrivateReadStream(storageKey) {
  // Create the object key constant.
  const objectKey = buildObjectKey(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!objectKey) {
    // Return the resulting value to the caller.
    return null;
  }

  // Destructure object properties into local variables.
  const { bucket } = getConfig();
  // Create the client constant.
  const client = createS3Client();
  // Protected block: isolate failure modes.
  try {
    // Create the response constant.
    const response = await client.send(
      // Continue the surrounding logic with this statement.
      new GetObjectCommand({
        // Provide the bucket field value.
        Bucket: bucket,
        // Provide the key field value.
        Key: objectKey,
      })
    );
    // Guard: early-return or throw when required input is missing/invalid.
    if (!response.Body) {
      // Return the resulting value to the caller.
      return null;
    }
    // Return the resulting value to the caller.
    return { stream: response.Body };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (isNotFoundError(err)) {
      // Return the resulting value to the caller.
      return null;
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * Delete private file; returns whether a row was affected.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function deletePrivateFile(storageKey) {
  // Create the object key constant.
  const objectKey = buildObjectKey(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!objectKey) return false;

  // Destructure object properties into local variables.
  const { bucket } = getConfig();
  // Create the client constant.
  const client = createS3Client();
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await client.send(
      // Continue the surrounding logic with this statement.
      new DeleteObjectCommand({
        // Provide the bucket field value.
        Bucket: bucket,
        // Provide the key field value.
        Key: objectKey,
      })
    );
    // Return the resulting value to the caller.
    return true;
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (isNotFoundError(err)) {
      // Return the resulting value to the caller.
      return false;
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * private file exists.
 * @param {string} storageKey
 * @returns {Promise<*>}
 */
async function privateFileExists(storageKey) {
  // Create the object key constant.
  const objectKey = buildObjectKey(storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!objectKey) return false;

  // Destructure object properties into local variables.
  const { bucket } = getConfig();
  // Create the client constant.
  const client = createS3Client();
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await client.send(
      // Continue the surrounding logic with this statement.
      new HeadObjectCommand({
        // Provide the bucket field value.
        Bucket: bucket,
        // Provide the key field value.
        Key: objectKey,
      })
    );
    // Return the resulting value to the caller.
    return true;
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (isNotFoundError(err)) {
      // Return the resulting value to the caller.
      return false;
    }
    // Throw an error to stop the current control flow.
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

// Assign the CommonJS module exports.
module.exports = {
  // Provide the driver field value.
  driver: 's3',
  // Contribute this line to the enclosing declaration or statement.
  KEY_PREFIX,
  // Contribute this line to the enclosing declaration or statement.
  generatePrivateKey,
  // Contribute this line to the enclosing declaration or statement.
  ensurePrivateDir,
  // Contribute this line to the enclosing declaration or statement.
  storePrivateFile,
  // Contribute this line to the enclosing declaration or statement.
  storePrivateBuffer,
  // Contribute this line to the enclosing declaration or statement.
  openPrivateReadStream,
  // Contribute this line to the enclosing declaration or statement.
  deletePrivateFile,
  // Contribute this line to the enclosing declaration or statement.
  privateFileExists,
};
