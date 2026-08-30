const privateStorage = require('../../storage/privateStorageService');
const { removeUploadedFile } = require('../../../middleware/fileUpload/uploadUtils');

const FUEL_LEVELS = new Set(['empty', 'quarter', 'half', 'three_quarters', 'full']);

async function storeUpload(file, category) {
  if (!file) return null;
  const stored = await privateStorage.storePrivateFile({
    tempPath: file.path,
    originalName: file.originalname,
    category,
    mimeType: file.mimetype,
  });
  return stored.storageKey;
}

async function storeUploads(files = [], category) {
  const keys = [];
  for (const file of files) {
    keys.push(await storeUpload(file, category));
  }
  return keys.filter(Boolean);
}

function parseFiles(req) {
  const files = req.files || {};
  return {
    photos: files.photos || [],
    customerSignature: files.customerSignature?.[0] || null,
    employeeSignature: files.employeeSignature?.[0] || null,
  };
}

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
