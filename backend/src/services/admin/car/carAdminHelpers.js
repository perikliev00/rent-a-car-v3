const storage = require('../../storage');

function parsePriceTier(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseCategoryId(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveCategoryId(payload, existingCar) {
  if (Object.prototype.hasOwnProperty.call(payload, 'categoryId')) {
    return parseCategoryId(payload.categoryId);
  }
  if (existingCar && existingCar.categoryId !== undefined) {
    return existingCar.categoryId;
  }
  return null;
}

function deriveBasePrice({ tierShort, tierMedium, tierLong }) {
  if (tierShort !== undefined) return tierShort;
  if (tierMedium !== undefined) return tierMedium;
  if (tierLong !== undefined) return tierLong;
  return undefined;
}

function buildImagePath(file, fallback = '') {
  if (!file) return fallback;
  return file.publicUrl || storage.buildPublicUrl(file.filename);
}

async function deleteManagedImageIfUnused(publicUrl) {
  if (!publicUrl || !storage.isManagedPublicUrl(publicUrl)) {
    return;
  }
  await storage.deleteByPublicUrl(publicUrl);
}

function emptyToNull(value) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function parseOptionalInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseInt(String(value), 10);
  return Number.isInteger(n) ? n : null;
}

function parseOptionalFloat(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

module.exports = {
  parsePriceTier,
  parseCategoryId,
  resolveCategoryId,
  deriveBasePrice,
  buildImagePath,
  deleteManagedImageIfUnused,
  emptyToNull,
  parseOptionalInt,
  parseOptionalFloat,
};
