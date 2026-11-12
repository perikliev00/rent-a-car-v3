/**
 * S3/compatible driver for public car images (STORAGE_DRIVER=s3).
 * Requires S3_BUCKET and STORAGE_PUBLIC_BASE_URL; re-encodes uploads via Sharp.
 */
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  S3Client,
  // Contribute this line to the enclosing declaration or statement.
  PutObjectCommand,
  // Contribute this line to the enclosing declaration or statement.
  GetObjectCommand,
  // Contribute this line to the enclosing declaration or statement.
  DeleteObjectCommand,
  // Contribute this line to the enclosing declaration or statement.
  ListObjectsV2Command,
// Continue the surrounding logic with this statement.
} = require('@aws-sdk/client-s3');
// Destructure object properties into local variables.
const { reencodeCarImageToBuffer } = require('./imageProcessing');

// Create the upload temp dir constant.
const UPLOAD_TEMP_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'tmp');
// Create the managed filename prefix constant.
const MANAGED_FILENAME_PREFIX = 'car-';

/**
 * Load config.
 * @returns {*}
 */
function getConfig() {
  // Create the bucket constant.
  const bucket = process.env.S3_BUCKET;
  // Create the public base url constant.
  const publicBaseUrl = (process.env.STORAGE_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  // Create the key prefix constant.
  const keyPrefix = process.env.S3_KEY_PREFIX || 'uploads/';

  // Guard: early-return or throw when required input is missing/invalid.
  if (!bucket) {
    // Throw an error to stop the current control flow.
    throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3.');
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!publicBaseUrl) {
    // Throw an error to stop the current control flow.
    throw new Error('STORAGE_PUBLIC_BASE_URL is required when STORAGE_DRIVER=s3.');
  }

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    bucket,
    // Contribute this line to the enclosing declaration or statement.
    publicBaseUrl,
    // Provide the key prefix field value.
    keyPrefix: keyPrefix.endsWith('/') ? keyPrefix : `${keyPrefix}/`,
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
 * @param {string} filename
 * @returns {*}
 */
function buildObjectKey(filename) {
  // Destructure object properties into local variables.
  const { keyPrefix } = getConfig();
  // Return the resulting value to the caller.
  return `${keyPrefix}${filename}`;
}

/**
 * Transform helper: build public url.
 * @param {string} filename
 * @returns {*}
 */
function buildPublicUrl(filename) {
  // Destructure object properties into local variables.
  const { publicBaseUrl } = getConfig();
  // Return the resulting value to the caller.
  return `${publicBaseUrl}/${filename}`;
}

/**
 * filename from public url.
 * @param {*} publicUrl
 * @returns {*}
 */
function filenameFromPublicUrl(publicUrl) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  // Return the resulting value to the caller.
  return path.posix.basename(publicUrl.split('?')[0]);
}

/**
 * generate stored filename.
 * @param {string} originalName
 * @returns {*}
 */
function generateStoredFilename(originalName) {
  // Create the unique constant.
  const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
  // Create the ext constant.
  const ext = path.extname(originalName || '').toLowerCase();
  // Return the resulting value to the caller.
  return `${MANAGED_FILENAME_PREFIX}${unique}${ext}`;
}

/**
 * Predicate helper: is managed public url.
 * @param {*} publicUrl
 * @returns {*}
 */
function isManagedPublicUrl(publicUrl) {
  // Create the filename constant.
  const filename = filenameFromPublicUrl(publicUrl);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filename || !filename.startsWith(MANAGED_FILENAME_PREFIX)) {
    // Return the resulting value to the caller.
    return false;
  }

  // Destructure object properties into local variables.
  const { publicBaseUrl } = getConfig();
  // Return the resulting value to the caller.
  return publicUrl.startsWith(`${publicBaseUrl}/`);
}

/**
 * Ensure temp dir exists or is initialized.
 * @returns {Promise<*>}
 */
async function ensureTempDir() {
  // Wait until the asynchronous operation resolves.
  await fs.promises.mkdir(UPLOAD_TEMP_DIR, { recursive: true });
}

/**
 * Delete by path; returns whether a row was affected.
 * @param {*} filePath
 * @returns {Promise<*>}
 */
async function deleteByPath(filePath) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filePath) return;
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await fs.promises.unlink(filePath);
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Ignore missing files.
  }
}

/**
 * process uploaded file with domain side effects as documented by callers.
 * @param {object} params
 * @returns {Promise<*>}
 */
async function processUploadedFile({ tempPath, tempFilename }) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!tempPath) {
    // Throw an error to stop the current control flow.
    throw new Error('Missing temp upload path.');
  }

  // Create the base name constant.
  const baseName = path.basename(tempFilename, path.extname(tempFilename));
  // Create the output filename constant.
  const outputFilename = `${baseName}.jpg`;
  // Create the key constant.
  const key = buildObjectKey(outputFilename);
  // Create the body constant.
  const body = await reencodeCarImageToBuffer(tempPath);

  // Wait until the asynchronous operation resolves.
  await deleteByPath(tempPath);

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
      Key: key,
      // Provide the body field value.
      Body: body,
      // Provide the content type field value.
      ContentType: 'image/jpeg',
      // Provide the cache control field value.
      CacheControl: 'public, max-age=31536000',
      // Provide the acl field value.
      ACL: 'public-read',
    })
  );

  // Return the resulting value to the caller.
  return {
    // Provide the filename field value.
    filename: outputFilename,
    // Contribute this line to the enclosing declaration or statement.
    key,
    // Provide the public url field value.
    publicUrl: buildPublicUrl(outputFilename),
    // Provide the mimetype field value.
    mimetype: 'image/jpeg',
  };
}

/**
 * Delete by public url; returns whether a row was affected.
 * @param {*} publicUrl
 * @returns {Promise<*>}
 */
async function deleteByPublicUrl(publicUrl) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!isManagedPublicUrl(publicUrl)) return false;

  // Create the filename constant.
  const filename = filenameFromPublicUrl(publicUrl);
  // Destructure object properties into local variables.
  const { bucket } = getConfig();
  // Create the client constant.
  const client = createS3Client();

  // Wait until the asynchronous operation resolves.
  await client.send(
    // Continue the surrounding logic with this statement.
    new DeleteObjectCommand({
      // Provide the bucket field value.
      Bucket: bucket,
      // Provide the key field value.
      Key: buildObjectKey(filename),
    })
  );

  // Return the resulting value to the caller.
  return true;
}

/**
 * open managed public read stream.
 * @param {*} publicUrl
 * @returns {Promise<*>}
 */
async function openManagedPublicReadStream(publicUrl) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!isManagedPublicUrl(publicUrl)) return null;

  // Create the filename constant.
  const filename = filenameFromPublicUrl(publicUrl);
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
        Key: buildObjectKey(filename),
      })
    );
    // Guard: early-return or throw when required input is missing/invalid.
    if (!response.Body) return null;
    // Return the resulting value to the caller.
    return {
      // Provide the stream field value.
      stream: response.Body,
      // Provide the mime type field value.
      mimeType: response.ContentType || 'image/jpeg',
    };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the status constant.
    const status = err?.$metadata?.httpStatusCode;
    // Status / lifecycle guard before mutating domain state.
    if (err?.name === 'NotFound' || err?.name === 'NoSuchKey' || status === 404) {
      // Return the resulting value to the caller.
      return null;
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * List managed public urls from SQL.
 * @returns {Promise<*>}
 */
async function listManagedPublicUrls() {
  // Destructure object properties into local variables.
  const { bucket, keyPrefix } = getConfig();
  // Create the client constant.
  const client = createS3Client();
  // Create the urls constant.
  const urls = [];
  // Reserve the continuation token variable for later assignment.
  let continuationToken;

  // Enter the do-while body before re-checking the condition.
  do {
    // Create the response constant.
    const response = await client.send(
      // Continue the surrounding logic with this statement.
      new ListObjectsV2Command({
        // Provide the bucket field value.
        Bucket: bucket,
        // Provide the prefix field value.
        Prefix: keyPrefix,
        // Provide the continuation token field value.
        ContinuationToken: continuationToken,
      })
    );

    // Iterate using the loop initializer, condition, and step.
    for (const item of response.Contents || []) {
      // Create the filename constant.
      const filename = path.posix.basename(item.Key);
      // Evaluate the condition and enter the branch when it is true.
      if (!filename.startsWith(MANAGED_FILENAME_PREFIX)) continue;
      // Call urls.push to perform this step.
      urls.push(buildPublicUrl(filename));
    }

    // Update continuationToken with the right-hand side value.
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  // Continue the surrounding logic with this statement.
  } while (continuationToken);

  // Return the resulting value to the caller.
  return urls;
}

/**
 * cleanup orphans.
 * @param {*} referencedPublicUrls
 * @returns {Promise<*>}
 */
async function cleanupOrphans(referencedPublicUrls) {
  // Create the referenced constant.
  const referenced = new Set(referencedPublicUrls);
  // Create the managed constant.
  const managed = await listManagedPublicUrls();
  // Create the removed constant.
  const removed = [];

  // Iterate using the loop initializer, condition, and step.
  for (const publicUrl of managed) {
    // Evaluate the condition and enter the branch when it is true.
    if (referenced.has(publicUrl)) continue;
    // Evaluate the condition and enter the branch when it is true.
    if (await deleteByPublicUrl(publicUrl)) {
      // Call removed.push to perform this step.
      removed.push(publicUrl);
    }
  }

  // Return the resulting value to the caller.
  return { removed };
}

/**
 * cleanup stale temp files.
 * @param {*} maxAgeMs
 * @returns {Promise<*>}
 */
async function cleanupStaleTempFiles(maxAgeMs) {
  // Create the removed constant.
  const removed = [];
  // Reserve the entries variable for later assignment.
  let entries;

  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in entries.
    entries = await fs.promises.readdir(UPLOAD_TEMP_DIR, { withFileTypes: true });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'ENOENT') return { removed };
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the cutoff constant.
  const cutoff = Date.now() - maxAgeMs;

  // Iterate using the loop initializer, condition, and step.
  for (const entry of entries) {
    // Guard: early-return or throw when required input is missing/invalid.
    if (!entry.isFile()) continue;
    // Create the file path constant.
    const filePath = path.join(UPLOAD_TEMP_DIR, entry.name);
    // Create the stat constant.
    const stat = await fs.promises.stat(filePath);
    // Evaluate the condition and enter the branch when it is true.
    if (stat.mtimeMs >= cutoff) continue;
    // Wait until the asynchronous operation resolves.
    await deleteByPath(filePath);
    // Call removed.push to perform this step.
    removed.push(filePath);
  }

  // Return the resulting value to the caller.
  return { removed };
}

// Assign the CommonJS module exports.
module.exports = {
  // Provide the driver field value.
  driver: 's3',
  // Contribute this line to the enclosing declaration or statement.
  UPLOAD_TEMP_DIR,
  // Contribute this line to the enclosing declaration or statement.
  generateStoredFilename,
  // Contribute this line to the enclosing declaration or statement.
  buildPublicUrl,
  // Contribute this line to the enclosing declaration or statement.
  isManagedPublicUrl,
  // Contribute this line to the enclosing declaration or statement.
  ensureTempDir,
  // Contribute this line to the enclosing declaration or statement.
  deleteByPath,
  // Contribute this line to the enclosing declaration or statement.
  processUploadedFile,
  // Contribute this line to the enclosing declaration or statement.
  deleteByPublicUrl,
  // Contribute this line to the enclosing declaration or statement.
  openManagedPublicReadStream,
  // Contribute this line to the enclosing declaration or statement.
  listManagedPublicUrls,
  // Contribute this line to the enclosing declaration or statement.
  cleanupOrphans,
  // Contribute this line to the enclosing declaration or statement.
  cleanupStaleTempFiles,
};
