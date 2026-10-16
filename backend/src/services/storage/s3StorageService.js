/**
 * S3/compatible driver for public car images (STORAGE_DRIVER=s3).
 * Requires S3_BUCKET and STORAGE_PUBLIC_BASE_URL; re-encodes uploads via Sharp.
 */
const fs = require('fs');
const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { reencodeCarImageToBuffer } = require('./imageProcessing');

const UPLOAD_TEMP_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'tmp');
const MANAGED_FILENAME_PREFIX = 'car-';

/**
 * Load config.
 * @returns {*}
 */
function getConfig() {
  const bucket = process.env.S3_BUCKET;
  const publicBaseUrl = (process.env.STORAGE_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const keyPrefix = process.env.S3_KEY_PREFIX || 'uploads/';

  // Guard: early-return or throw when required input is missing/invalid.
  if (!bucket) {
    throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3.');
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!publicBaseUrl) {
    throw new Error('STORAGE_PUBLIC_BASE_URL is required when STORAGE_DRIVER=s3.');
  }

  return {
    bucket,
    publicBaseUrl,
    keyPrefix: keyPrefix.endsWith('/') ? keyPrefix : `${keyPrefix}/`,
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
 * @param {string} filename
 * @returns {*}
 */
function buildObjectKey(filename) {
  const { keyPrefix } = getConfig();
  return `${keyPrefix}${filename}`;
}

/**
 * Transform helper: build public url.
 * @param {string} filename
 * @returns {*}
 */
function buildPublicUrl(filename) {
  const { publicBaseUrl } = getConfig();
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
  return path.posix.basename(publicUrl.split('?')[0]);
}

/**
 * generate stored filename.
 * @param {string} originalName
 * @returns {*}
 */
function generateStoredFilename(originalName) {
  const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName || '').toLowerCase();
  return `${MANAGED_FILENAME_PREFIX}${unique}${ext}`;
}

/**
 * Predicate helper: is managed public url.
 * @param {*} publicUrl
 * @returns {*}
 */
function isManagedPublicUrl(publicUrl) {
  const filename = filenameFromPublicUrl(publicUrl);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!filename || !filename.startsWith(MANAGED_FILENAME_PREFIX)) {
    return false;
  }

  const { publicBaseUrl } = getConfig();
  return publicUrl.startsWith(`${publicBaseUrl}/`);
}

/**
 * Ensure temp dir exists or is initialized.
 * @returns {Promise<*>}
 */
async function ensureTempDir() {
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
    await fs.promises.unlink(filePath);
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
    throw new Error('Missing temp upload path.');
  }

  const baseName = path.basename(tempFilename, path.extname(tempFilename));
  const outputFilename = `${baseName}.jpg`;
  const key = buildObjectKey(outputFilename);
  const body = await reencodeCarImageToBuffer(tempPath);

  await deleteByPath(tempPath);

  const { bucket } = getConfig();
  const client = createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000',
      ACL: 'public-read',
    })
  );

  return {
    filename: outputFilename,
    key,
    publicUrl: buildPublicUrl(outputFilename),
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

  const filename = filenameFromPublicUrl(publicUrl);
  const { bucket } = getConfig();
  const client = createS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: buildObjectKey(filename),
    })
  );

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

  const filename = filenameFromPublicUrl(publicUrl);
  const { bucket } = getConfig();
  const client = createS3Client();

  // Protected block: isolate failure modes.
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: buildObjectKey(filename),
      })
    );
    // Guard: early-return or throw when required input is missing/invalid.
    if (!response.Body) return null;
    return {
      stream: response.Body,
      mimeType: response.ContentType || 'image/jpeg',
    };
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    // Status / lifecycle guard before mutating domain state.
    if (err?.name === 'NotFound' || err?.name === 'NoSuchKey' || status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * List managed public urls from SQL.
 * @returns {Promise<*>}
 */
async function listManagedPublicUrls() {
  const { bucket, keyPrefix } = getConfig();
  const client = createS3Client();
  const urls = [];
  let continuationToken;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: keyPrefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const item of response.Contents || []) {
      const filename = path.posix.basename(item.Key);
      if (!filename.startsWith(MANAGED_FILENAME_PREFIX)) continue;
      urls.push(buildPublicUrl(filename));
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return urls;
}

/**
 * cleanup orphans.
 * @param {*} referencedPublicUrls
 * @returns {Promise<*>}
 */
async function cleanupOrphans(referencedPublicUrls) {
  const referenced = new Set(referencedPublicUrls);
  const managed = await listManagedPublicUrls();
  const removed = [];

  for (const publicUrl of managed) {
    if (referenced.has(publicUrl)) continue;
    if (await deleteByPublicUrl(publicUrl)) {
      removed.push(publicUrl);
    }
  }

  return { removed };
}

/**
 * cleanup stale temp files.
 * @param {*} maxAgeMs
 * @returns {Promise<*>}
 */
async function cleanupStaleTempFiles(maxAgeMs) {
  const removed = [];
  let entries;

  // Protected block: isolate failure modes.
  try {
    entries = await fs.promises.readdir(UPLOAD_TEMP_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return { removed };
    throw err;
  }

  const cutoff = Date.now() - maxAgeMs;

  for (const entry of entries) {
    // Guard: early-return or throw when required input is missing/invalid.
    if (!entry.isFile()) continue;
    const filePath = path.join(UPLOAD_TEMP_DIR, entry.name);
    const stat = await fs.promises.stat(filePath);
    if (stat.mtimeMs >= cutoff) continue;
    await deleteByPath(filePath);
    removed.push(filePath);
  }

  return { removed };
}

module.exports = {
  driver: 's3',
  UPLOAD_TEMP_DIR,
  generateStoredFilename,
  buildPublicUrl,
  isManagedPublicUrl,
  ensureTempDir,
  deleteByPath,
  processUploadedFile,
  deleteByPublicUrl,
  openManagedPublicReadStream,
  listManagedPublicUrls,
  cleanupOrphans,
  cleanupStaleTempFiles,
};
