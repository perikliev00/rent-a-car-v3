/**
 * Private document storage facade selected by PRIVATE_STORAGE_DRIVER (local | s3).
 * Used for customer docs and other non-public files (never served as static URLs).
 */
const { wrapStorageMetrics } = require('./wrapStorageMetrics');

/**
 * Insert private storage service and return the mapped result.
 * @returns {*}
 */
function createPrivateStorageService() {
  const driver = (process.env.PRIVATE_STORAGE_DRIVER || 'local').toLowerCase();

  let impl;
  if (driver === 's3') {
    impl = require('./privateS3StorageService');
  } else if (driver !== 'local') {
    throw new Error(`Unsupported PRIVATE_STORAGE_DRIVER: ${driver}`);
  } else {
    impl = require('./privateLocalStorageService');
  }

  return wrapStorageMetrics(impl);
}

module.exports = createPrivateStorageService();
