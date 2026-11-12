/**
 * Small parsing/storage helpers shared by admin car CRUD and related services.
 */
const storage = require('../../storage');

/** Parse a price-tier form field; empty → undefined (omit), invalid → undefined. */
function parsePriceTier(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (value === undefined || value === null || value === '') return undefined;
  // Create the parsed constant.
  const parsed = parseFloat(value);
  // Return the resulting value to the caller.
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Positive integer category id, or null when cleared/invalid. */
function parseCategoryId(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (value === undefined || value === null || value === '') return null;
  // Create the parsed constant.
  const parsed = parseInt(String(value), 10);
  // Return the resulting value to the caller.
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Prefer payload.categoryId when the key is present (allows explicit clear to null);
 * otherwise keep the existing car's category.
 */
function resolveCategoryId(payload, existingCar) {
  // Evaluate the condition and enter the branch when it is true.
  if (Object.prototype.hasOwnProperty.call(payload, 'categoryId')) {
    // Return the resulting value to the caller.
    return parseCategoryId(payload.categoryId);
  }
  // Idempotency guard: return early when work was already applied.
  if (existingCar && existingCar.categoryId !== undefined) {
    // Return the resulting value to the caller.
    return existingCar.categoryId;
  }
  // Return the resulting value to the caller.
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
  // Return the resulting value to the caller.
  return undefined;
}

/** Public URL for an uploaded car image, or fallback when no file. */
function buildImagePath(file, fallback = '') {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!file) return fallback;
  // Return the resulting value to the caller.
  return file.publicUrl || storage.buildPublicUrl(file.filename);
}

/**
 * Delete a managed storage object only when the URL is ours (never touch external CDN URLs).
 */
async function deleteManagedImageIfUnused(publicUrl) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!publicUrl || !storage.isManagedPublicUrl(publicUrl)) {
    // Return control to the caller with the following value.
    return;
  }
  // Wait until the asynchronous operation resolves.
  await storage.deleteByPublicUrl(publicUrl);
}

/** Empty string / undefined → null for nullable DB columns. */
function emptyToNull(value) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (value === undefined || value === null || value === '') return null;
  // Return the resulting value to the caller.
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
  // Create the n constant.
  const n = parseInt(String(value), 10);
  // Return the resulting value to the caller.
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
  // Create the n constant.
  const n = parseFloat(value);
  // Return the resulting value to the caller.
  return Number.isFinite(n) ? n : null;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  parsePriceTier,
  // Contribute this line to the enclosing declaration or statement.
  parseCategoryId,
  // Contribute this line to the enclosing declaration or statement.
  resolveCategoryId,
  // Contribute this line to the enclosing declaration or statement.
  deriveBasePrice,
  // Contribute this line to the enclosing declaration or statement.
  buildImagePath,
  // Contribute this line to the enclosing declaration or statement.
  deleteManagedImageIfUnused,
  // Contribute this line to the enclosing declaration or statement.
  emptyToNull,
  // Contribute this line to the enclosing declaration or statement.
  parseOptionalInt,
  // Contribute this line to the enclosing declaration or statement.
  parseOptionalFloat,
};
