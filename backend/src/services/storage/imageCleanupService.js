/**
 * Scheduled/ops cleanup for orphan car images and stale upload temp files.
 * Only removes objects managed by the public storage driver.
 */
const logger = require('../../utils/logger');
// Require the '../../repositories/carRepository' module as carRepository.
const carRepository = require('../../repositories/carRepository');
// Require the './index' module as storage.
const storage = require('./index');

// Create the stale temp max age ms constant.
const STALE_TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Create the api temp janitor max age ms constant.
const API_TEMP_JANITOR_MAX_AGE_MS = 15 * 60 * 1000;
// Create the api temp janitor interval ms constant.
const API_TEMP_JANITOR_INTERVAL_MS = 5 * 60 * 1000;
// Create the temp file quota constant.
const TEMP_FILE_QUOTA = 200;

// Initialize the mutable janitor timer variable.
let janitorTimer = null;

/**
 * List referenced car image urls from SQL.
 * @returns {Promise<*>}
 */
async function listReferencedCarImageUrls() {
  // Return the resulting value to the caller.
  return carRepository.listAllImageUrls();
}

/** Delete managed public images not referenced by any car record. */
async function cleanupOrphanCarImages() {
  // Protected block: isolate failure modes.
  try {
    // Create the referenced constant.
    const referenced = (await listReferencedCarImageUrls()).filter((url) =>
      // Call storage.isManagedPublicUrl to perform this step.
      storage.isManagedPublicUrl(url)
    );
    // Destructure object properties into local variables.
    const { removed } = await storage.cleanupOrphans(referenced);
    // Evaluate the condition and enter the branch when it is true.
    if (removed.length > 0) {
      // Call logger.info to perform this step.
      logger.info({ count: removed.length, removed }, 'Orphan car images removed');
    }
    // Return the resulting value to the caller.
    return { removed };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err }, 'Orphan car image cleanup failed');
    // Return the resulting value to the caller.
    return { removed: [] };
  }
}

/** Remove temp uploads older than the given age. */
async function cleanupStaleUploadTempFiles(maxAgeMs = STALE_TEMP_MAX_AGE_MS) {
  // Protected block: isolate failure modes.
  try {
    // Destructure object properties into local variables.
    const { removed } = await storage.cleanupStaleTempFiles(maxAgeMs);
    // Evaluate the condition and enter the branch when it is true.
    if (removed.length > 0) {
      // Call logger.info to perform this step.
      logger.info({ count: removed.length }, 'Stale upload temp files removed');
    }
    // Return the resulting value to the caller.
    return { removed };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err }, 'Stale upload temp cleanup failed');
    // Return the resulting value to the caller.
    return { removed: [] };
  }
}

/** Run stale-temp then orphan cleanup (job entrypoint). */
async function cleanupCarImages() {
  // Wait until the asynchronous operation resolves.
  await cleanupStaleUploadTempFiles();
  // Wait until the asynchronous operation resolves.
  await cleanupOrphanCarImages();
}

/**
 * Delete abandoned temp uploads in this process. Used by the API when the
 * worker does not share the upload temp directory.
 */
function startUploadTempJanitor() {
  // Evaluate the condition and enter the branch when it is true.
  if (janitorTimer) return;
  // Create the tick constant.
  const tick = () => {
    // Call cleanupStaleUploadTempFiles to perform this step.
    cleanupStaleUploadTempFiles(API_TEMP_JANITOR_MAX_AGE_MS).catch((err) => {
      // Call logger.error to perform this step.
      logger.error({ err }, 'API upload temp janitor failed');
    });
  };
  // Update janitorTimer with the right-hand side value.
  janitorTimer = setInterval(tick, API_TEMP_JANITOR_INTERVAL_MS);
  // Continue the surrounding logic with this statement.
  janitorTimer.unref?.();
}

// Define the stopUploadTempJanitor function.
function stopUploadTempJanitor() {
  // Evaluate the condition and enter the branch when it is true.
  if (!janitorTimer) return;
  // Call clearInterval to perform this step.
  clearInterval(janitorTimer);
  // Update janitorTimer with the right-hand side value.
  janitorTimer = null;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  cleanupOrphanCarImages,
  // Contribute this line to the enclosing declaration or statement.
  cleanupStaleUploadTempFiles,
  // Contribute this line to the enclosing declaration or statement.
  cleanupCarImages,
  // Contribute this line to the enclosing declaration or statement.
  startUploadTempJanitor,
  // Contribute this line to the enclosing declaration or statement.
  stopUploadTempJanitor,
  // Contribute this line to the enclosing declaration or statement.
  STALE_TEMP_MAX_AGE_MS,
  // Contribute this line to the enclosing declaration or statement.
  API_TEMP_JANITOR_MAX_AGE_MS,
  // Contribute this line to the enclosing declaration or statement.
  TEMP_FILE_QUOTA,
};
