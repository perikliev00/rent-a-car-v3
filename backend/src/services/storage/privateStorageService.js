const { wrapStorageMetrics } = require('./wrapStorageMetrics');

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
