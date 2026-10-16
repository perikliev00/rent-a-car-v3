/**
 * Shared multer/private-storage helpers for pickup and return checklist uploads.
 */
const privateStorage = require('../../storage/privateStorageService');
const { removeUploadedFile } = require('../../../middleware/fileUpload/uploadUtils');

const FUEL_LEVELS = new Set(['empty', 'quarter', 'half', 'three_quarters', 'full']);

/**
 * Persist one temp upload into private storage; returns storage key or null.
 * @param {object|null} file
 * @param {string} category
 */
async function storeUpload(file, category) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!file) return null;
  const stored = await privateStorage.storePrivateFile({
    tempPath: file.path,
    originalName: file.originalname,
    category,
    mimeType: file.mimetype,
  });
  return stored.storageKey;
}

/** @param {object[]} [files] @param {string} category */
async function storeUploads(files = [], category) {
  const keys = [];
  for (const file of files) {
    keys.push(await storeUpload(file, category));
  }
  return keys.filter(Boolean);
}

/** Extract typed multer fields used by checklist forms. */
function parseFiles(req) {
  const files = req.files || {};
  return {
    photos: files.photos || [],
    customerSignature: files.customerSignature?.[0] || null,
    employeeSignature: files.employeeSignature?.[0] || null,
  };
}

/** Remove temp upload files after success or failure. */
async function cleanupTemp(req) {
  const { photos, customerSignature, employeeSignature } = parseFiles(req);
  for (const f of [...photos, customerSignature, employeeSignature].filter(Boolean)) {
    await removeUploadedFile(f);
  }
}

module.exports = {
  FUEL_LEVELS,
  storeUpload,
  storeUploads,
  parseFiles,
  cleanupTemp,
};
