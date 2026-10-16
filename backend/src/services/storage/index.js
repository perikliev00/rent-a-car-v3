/**
 * Public car-image storage facade selected by STORAGE_DRIVER (local | s3).
 * Exports a metrics-wrapped driver module used for managed public uploads.
 */
const { wrapStorageMetrics } = require('./wrapStorageMetrics');

/**
 * Insert storage service and return the mapped result.
 * @returns {*}
 */
function createStorageService() {
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

  let impl;
  if (driver === 's3') {
    impl = require('./s3StorageService');
  } else if (driver !== 'local') {
    throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
  } else {
    impl = require('./localStorageService');
  }

  return wrapStorageMetrics(impl);
}

module.exports = createStorageService();
