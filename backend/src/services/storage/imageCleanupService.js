const logger = require('../../utils/logger');
const carRepository = require('../../repositories/carRepository');
const storage = require('./index');

const STALE_TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function listReferencedCarImageUrls() {
  return carRepository.listAllImageUrls();
}

async function cleanupOrphanCarImages() {
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

async function cleanupStaleUploadTempFiles() {
  try {
    const { removed } = await storage.cleanupStaleTempFiles(STALE_TEMP_MAX_AGE_MS);
    if (removed.length > 0) {
      logger.info({ count: removed.length }, 'Stale upload temp files removed');
    }
    return { removed };
  } catch (err) {
    logger.error({ err }, 'Stale upload temp cleanup failed');
    return { removed: [] };
  }
}

async function cleanupCarImages() {
  await cleanupStaleUploadTempFiles();
  await cleanupOrphanCarImages();
}

module.exports = {
  cleanupOrphanCarImages,
  cleanupStaleUploadTempFiles,
  cleanupCarImages,
};
