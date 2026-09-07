const { wrapStorageMetrics } = require('./wrapStorageMetrics');

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
