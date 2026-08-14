const path = require('path');
const multer = require('multer');
const fileStorage = require('../services/storage');
const {
  ensureUploadTempDir,
  getNormalizedExtension,
  removeUploadedFile,
  readFileHead,
} = require('./fileUpload/uploadUtils');
const { handleMulterError } = require('./fileUpload/handleMulterError');
const { handleFileRejected } = require('./fileUpload/handleFileRejected');
const { adminUploadLimiter, accountUploadLimiter } = require('./rateLimit');
const apiResponse = require('../utils/apiResponse');

const ALLOWED_DOC_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.pdf']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const DOC_EXTENSION_TO_MIMETYPES = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
};

function matchesPdfMagic(buffer) {
  return buffer && buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-';
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

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    ensureUploadTempDir()
      .then(() => cb(null, fileStorage.UPLOAD_TEMP_DIR))
      .catch((err) => cb(err));
  },
  filename: function (req, file, cb) {
    cb(null, fileStorage.generateStoredFilename(file.originalname));
  },
});

function createFileFilter(allowedExtensions, rejectedMessage) {
  return function fileFilter(req, file, cb) {
    const ext = getNormalizedExtension(file.originalname);
    if (!allowedExtensions.has(ext)) {
      req.fileRejected = true;
      req.fileRejectedMessage = rejectedMessage;
      return cb(null, false);
    }
    const allowedMimes = DOC_EXTENSION_TO_MIMETYPES[ext];
    if (!allowedMimes || !allowedMimes.includes((file.mimetype || '').toLowerCase())) {
      req.fileRejected = true;
      req.fileRejectedMessage = rejectedMessage;
      return cb(null, false);
    }
    cb(null, true);
  };
}

const documentUpload = multer({
  storage: diskStorage,
  fileFilter: createFileFilter(
    ALLOWED_DOC_EXTENSIONS,
    'Only JPG, PNG, WEBP, or PDF files are allowed.'
  ),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const imageUpload = multer({
  storage: diskStorage,
  fileFilter: createFileFilter(
    ALLOWED_IMAGE_EXTENSIONS,
    'Only image files are allowed (JPG, JPEG, PNG, WEBP).'
  ),
  limits: { fileSize: 5 * 1024 * 1024 },
});

async function validatePrivateDocument(req, res, next) {
  const file = req.file;
  if (!file) {
    return next();
  }

  try {
    const ext = getNormalizedExtension(file.originalname || file.filename);
    const savedExt = path.extname(file.filename || '').toLowerCase();
    if (!ALLOWED_DOC_EXTENSIONS.has(ext) || ext !== savedExt) {
      await removeUploadedFile(file);
      req.fileValidationError = 'Only JPG, PNG, WEBP, or PDF files are allowed.';
      return next();
    }

    const head = await readFileHead(file.path, 12);
    const valid =
      ext === '.pdf' ? matchesPdfMagic(head) : matchesImageMagic(head, ext);
    if (!valid) {
      await removeUploadedFile(file);
      req.fileValidationError = 'Uploaded file content is invalid.';
      return next();
    }

    return next();
  } catch (err) {
    await removeUploadedFile(file);
    if (err.code === 'EACCES' || err.code === 'ENOSPC') {
      return next(err);
    }
    req.fileValidationError = 'Uploaded file content is invalid.';
    return next();
  }
}

async function validatePrivateImages(req, res, next) {
  const files = [];
  if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else if (req.files && typeof req.files === 'object') {
    for (const list of Object.values(req.files)) {
      if (Array.isArray(list)) files.push(...list);
    }
  } else if (req.file) {
    files.push(req.file);
  }

  if (!files.length) {
    return next();
  }

  try {
    for (const file of files) {
      const ext = getNormalizedExtension(file.originalname || file.filename);
      const savedExt = path.extname(file.filename || '').toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext) || ext !== savedExt) {
        req.fileValidationError = 'Only image files are allowed (JPG, JPEG, PNG, WEBP).';
        for (const f of files) await removeUploadedFile(f);
        return next();
      }
      const head = await readFileHead(file.path, 12);
      if (!matchesImageMagic(head, ext)) {
        req.fileValidationError = 'Uploaded file is not a valid image.';
        for (const f of files) await removeUploadedFile(f);
        return next();
      }
    }
    return next();
  } catch (err) {
    for (const f of files) await removeUploadedFile(f);
    if (err.code === 'EACCES' || err.code === 'ENOSPC') {
      return next(err);
    }
    req.fileValidationError = 'Uploaded file is not a valid image.';
    return next();
  }
}

function rejectIfFileValidationFailed(req, res, next) {
  if (req.fileValidationError) {
    return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
  }
  return next();
}

const customerDocumentUpload = [
  accountUploadLimiter || adminUploadLimiter,
  documentUpload.single('file'),
  handleMulterError,
  handleFileRejected,
  validatePrivateDocument,
  rejectIfFileValidationFailed,
];

const checklistUpload = [
  adminUploadLimiter,
  imageUpload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'customerSignature', maxCount: 1 },
    { name: 'employeeSignature', maxCount: 1 },
  ]),
  handleMulterError,
  handleFileRejected,
  validatePrivateImages,
  rejectIfFileValidationFailed,
];

module.exports = {
  customerDocumentUpload,
  checklistUpload,
  validatePrivateDocument,
  validatePrivateImages,
};
