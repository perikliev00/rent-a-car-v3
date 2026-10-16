/**
 * Small parsing/storage helpers shared by admin car CRUD and related services.
 */
const storage = require('../../storage');

/** Parse a price-tier form field; empty → undefined (omit), invalid → undefined. */
function parsePriceTier(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Positive integer category id, or null when cleared/invalid. */
function parseCategoryId(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Prefer payload.categoryId when the key is present (allows explicit clear to null);
 * otherwise keep the existing car's category.
 */
function resolveCategoryId(payload, existingCar) {
  if (Object.prototype.hasOwnProperty.call(payload, 'categoryId')) {
    return parseCategoryId(payload.categoryId);
  }
  // Idempotency guard: return early when work was already applied.
  if (existingCar && existingCar.categoryId !== undefined) {
    return existingCar.categoryId;
  }
  return null;
}

/** Prefer shortest tier as display base price when multiple tiers are set. */
function deriveBasePrice({ tierShort, tierMedium, tierLong }) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (tierShort !== undefined) return tierShort;
  // Guard: early-return or throw when required input is missing/invalid.
  if (tierMedium !== undefined) return tierMedium;
  // Guard: early-return or throw when required input is missing/invalid.
  if (tierLong !== undefined) return tierLong;
  return undefined;
}

/** Public URL for an uploaded car image, or fallback when no file. */
function buildImagePath(file, fallback = '') {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!file) return fallback;
  return file.publicUrl || storage.buildPublicUrl(file.filename);
}

/**
 * Delete a managed storage object only when the URL is ours (never touch external CDN URLs).
 */
async function deleteManagedImageIfUnused(publicUrl) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!publicUrl || !storage.isManagedPublicUrl(publicUrl)) {
    return;
  }
  await storage.deleteByPublicUrl(publicUrl);
}

/** Empty string / undefined → null for nullable DB columns. */
function emptyToNull(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (value === undefined || value === null || value === '') return null;
  return value;
}

/**
 * parse optional int.
 * @param {*} value
 * @returns {*}
 */
function parseOptionalInt(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (value === undefined || value === null || value === '') return null;
  const n = parseInt(String(value), 10);
  return Number.isInteger(n) ? n : null;
}

/**
 * parse optional float.
 * @param {*} value
 * @returns {*}
 */
function parseOptionalFloat(value) {
  // Guard: early-return or throw when required input is missing/invalid.
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
