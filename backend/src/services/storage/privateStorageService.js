function createPrivateStorageService() {
  const driver = (process.env.PRIVATE_STORAGE_DRIVER || 'local').toLowerCase();

  if (driver === 's3') {
    return require('./privateS3StorageService');
  }

  if (driver !== 'local') {
    throw new Error(`Unsupported PRIVATE_STORAGE_DRIVER: ${driver}`);
  }

  return require('./privateLocalStorageService');
}

module.exports = createPrivateStorageService();
