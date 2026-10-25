/**
 * Scheduled/ops cleanup for orphan car images and stale upload temp files.
 * Only removes objects managed by the public storage driver.
 */
const logger = require('../../utils/logger');
const carRepository = require('../../repositories/carRepository');
const storage = require('./index');

const STALE_TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const API_TEMP_JANITOR_MAX_AGE_MS = 15 * 60 * 1000;
const API_TEMP_JANITOR_INTERVAL_MS = 5 * 60 * 1000;
const TEMP_FILE_QUOTA = 200;

let janitorTimer = null;

/**
 * List referenced car image urls from SQL.
 * @returns {Promise<*>}
 */
async function listReferencedCarImageUrls() {
  return carRepository.listAllImageUrls();
}

/** Delete managed public images not referenced by any car record. */
async function cleanupOrphanCarImages() {
  // Protected block: isolate failure modes.
  try {
    const referenced = (await listReferencedCarImageUrls()).filter((url) =>
      storage.isManagedPublicUrl(url)
    );
    const { removed } = await storage.cleanupOrphans(referenced);
    if (removed.length > 0) {
      logger.info({ count: removed.length, removed }, 'Orphan car images removed');
    }
    return { removed };
  } catch (err) {
    logger.error({ err }, 'Orphan car image cleanup failed');
    return { removed: [] };
  }
}

/** Remove temp uploads older than the given age. */
async function cleanupStaleUploadTempFiles(maxAgeMs = STALE_TEMP_MAX_AGE_MS) {
  // Protected block: isolate failure modes.
  try {
    const { removed } = await storage.cleanupStaleTempFiles(maxAgeMs);
    if (removed.length > 0) {
      logger.info({ count: removed.length }, 'Stale upload temp files removed');
    }
    return { removed };
  } catch (err) {
    logger.error({ err }, 'Stale upload temp cleanup failed');
    return { removed: [] };
  }
}

/** Run stale-temp then orphan cleanup (job entrypoint). */
async function cleanupCarImages() {
  await cleanupStaleUploadTempFiles();
  await cleanupOrphanCarImages();
}

/**
 * Delete abandoned temp uploads in this process. Used by the API when the
 * worker does not share the upload temp directory.
 */
function startUploadTempJanitor() {
  if (janitorTimer) return;
  const tick = () => {
    cleanupStaleUploadTempFiles(API_TEMP_JANITOR_MAX_AGE_MS).catch((err) => {
      logger.error({ err }, 'API upload temp janitor failed');
    });
  };
  janitorTimer = setInterval(tick, API_TEMP_JANITOR_INTERVAL_MS);
  janitorTimer.unref?.();
}

function stopUploadTempJanitor() {
  if (!janitorTimer) return;
  clearInterval(janitorTimer);
  janitorTimer = null;
}

module.exports = {
  cleanupOrphanCarImages,
  cleanupStaleUploadTempFiles,
  cleanupCarImages,
  startUploadTempJanitor,
  stopUploadTempJanitor,
  STALE_TEMP_MAX_AGE_MS,
  API_TEMP_JANITOR_MAX_AGE_MS,
  TEMP_FILE_QUOTA,
};
