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

function getConfig() {
  const bucket = process.env.S3_BUCKET;
  const publicBaseUrl = (process.env.STORAGE_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const keyPrefix = process.env.S3_KEY_PREFIX || 'uploads/';

  if (!bucket) {
    throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3.');
  }
  if (!publicBaseUrl) {
    throw new Error('STORAGE_PUBLIC_BASE_URL is required when STORAGE_DRIVER=s3.');
  }

  return {
    bucket,
    publicBaseUrl,
    keyPrefix: keyPrefix.endsWith('/') ? keyPrefix : `${keyPrefix}/`,
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

function buildObjectKey(filename) {
  const { keyPrefix } = getConfig();
  return `${keyPrefix}${filename}`;
}

function buildPublicUrl(filename) {
  const { publicBaseUrl } = getConfig();
  return `${publicBaseUrl}/${filename}`;
}

function filenameFromPublicUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  return path.posix.basename(publicUrl.split('?')[0]);
}

function generateStoredFilename(originalName) {
  const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName || '').toLowerCase();
  return `${MANAGED_FILENAME_PREFIX}${unique}${ext}`;
}

function isManagedPublicUrl(publicUrl) {
  const filename = filenameFromPublicUrl(publicUrl);
  if (!filename || !filename.startsWith(MANAGED_FILENAME_PREFIX)) {
    return false;
  }

  const { publicBaseUrl } = getConfig();
  return publicUrl.startsWith(`${publicBaseUrl}/`);
}

async function ensureTempDir() {
  await fs.promises.mkdir(UPLOAD_TEMP_DIR, { recursive: true });
}

async function deleteByPath(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Ignore missing files.
  }
}

async function processUploadedFile({ tempPath, tempFilename }) {
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

async function deleteByPublicUrl(publicUrl) {
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

async function openManagedPublicReadStream(publicUrl) {
  if (!isManagedPublicUrl(publicUrl)) return null;

  const filename = filenameFromPublicUrl(publicUrl);
  const { bucket } = getConfig();
  const client = createS3Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: buildObjectKey(filename),
      })
    );
    if (!response.Body) return null;
    return {
      stream: response.Body,
      mimeType: response.ContentType || 'image/jpeg',
    };
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    if (err?.name === 'NotFound' || err?.name === 'NoSuchKey' || status === 404) {
      return null;
    }
    throw err;
  }
}

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

async function cleanupStaleTempFiles(maxAgeMs) {
  const removed = [];
  let entries;

  try {
    entries = await fs.promises.readdir(UPLOAD_TEMP_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return { removed };
    throw err;
  }

  const cutoff = Date.now() - maxAgeMs;

  for (const entry of entries) {
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
