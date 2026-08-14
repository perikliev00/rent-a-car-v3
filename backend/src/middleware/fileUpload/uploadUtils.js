const fs = require('fs');
const path = require('path');
const storage = require('../../services/storage');

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const EXTENSION_TO_MIMETYPES = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
};

async function ensureUploadTempDir() {
  return storage.ensureTempDir();
}

async function removeUploadedFile(file) {
  if (!file?.path) return;
  await storage.deleteByPath(file.path);
}

async function reencodeAndPromoteUpload(file) {
  if (!file?.path) return file;

  const processed = await storage.processUploadedFile({
    tempPath: file.path,
    tempFilename: file.filename,
  });

  file.filename = processed.filename;
  file.path = processed.path || file.path;
  file.mimetype = processed.mimetype;
  file.publicUrl = processed.publicUrl;
  return file;
}

async function readFileHead(filePath, length = 12) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

function matchesImageMagic(buffer, ext) {
  if (ext === '.jpg' || ext === '.jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (ext === '.png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (ext === '.webp') {
    return (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

function isAllowedImageExtension(ext) {
  return ALLOWED_IMAGE_EXTENSIONS.has(ext);
}

function isAllowedImageMimetype(ext, mimetype) {
  const allowed = EXTENSION_TO_MIMETYPES[ext];
  return Boolean(allowed && allowed.includes((mimetype || '').toLowerCase()));
}

function getNormalizedExtension(originalName) {
  return path.extname(originalName || '').toLowerCase();
}

module.exports = {
  ALLOWED_IMAGE_EXTENSIONS,
  EXTENSION_TO_MIMETYPES,
  UPLOAD_TEMP_DIR: storage.UPLOAD_TEMP_DIR,
  ensureUploadTempDir,
  removeUploadedFile,
  reencodeAndPromoteUpload,
  readFileHead,
  matchesImageMagic,
  isAllowedImageExtension,
  isAllowedImageMimetype,
  getNormalizedExtension,
};
