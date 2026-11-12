/**
 * Shared multer/private-storage helpers for pickup and return checklist uploads.
 */
const privateStorage = require('../../storage/privateStorageService');
// Destructure object properties into local variables.
const { removeUploadedFile } = require('../../../middleware/fileUpload/uploadUtils');

// Create the fuel levels constant.
const FUEL_LEVELS = new Set(['empty', 'quarter', 'half', 'three_quarters', 'full']);

/**
 * Persist one temp upload into private storage; returns storage key or null.
 * @param {object|null} file
 * @param {string} category
 */
async function storeUpload(file, category) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!file) return null;
  // Create the stored constant.
  const stored = await privateStorage.storePrivateFile({
    // Provide the temp path field value.
    tempPath: file.path,
    // Provide the original name field value.
    originalName: file.originalname,
    // Contribute this line to the enclosing declaration or statement.
    category,
    // Provide the mime type field value.
    mimeType: file.mimetype,
  });
  // Return the resulting value to the caller.
  return stored.storageKey;
}

/** @param {object[]} [files] @param {string} category */
async function storeUploads(files = [], category) {
  // Create the keys constant.
  const keys = [];
  // Iterate using the loop initializer, condition, and step.
  for (const file of files) {
    // Call keys.push to perform this step.
    keys.push(await storeUpload(file, category));
  }
  // Return the resulting value to the caller.
  return keys.filter(Boolean);
}

/** Extract typed multer fields used by checklist forms. */
function parseFiles(req) {
  // Create the files constant.
  const files = req.files || {};
  // Return the resulting value to the caller.
  return {
    // Provide the photos field value.
    photos: files.photos || [],
    // Provide the customer signature field value.
    customerSignature: files.customerSignature?.[0] || null,
    // Provide the employee signature field value.
    employeeSignature: files.employeeSignature?.[0] || null,
  };
}

/** Remove temp upload files after success or failure. */
async function cleanupTemp(req) {
  // Destructure object properties into local variables.
  const { photos, customerSignature, employeeSignature } = parseFiles(req);
  // Iterate using the loop initializer, condition, and step.
  for (const f of [...photos, customerSignature, employeeSignature].filter(Boolean)) {
    // Wait until the asynchronous operation resolves.
    await removeUploadedFile(f);
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  FUEL_LEVELS,
  // Contribute this line to the enclosing declaration or statement.
  storeUpload,
  // Contribute this line to the enclosing declaration or statement.
  storeUploads,
  // Contribute this line to the enclosing declaration or statement.
  parseFiles,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTemp,
};
