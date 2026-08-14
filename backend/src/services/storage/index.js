function createStorageService() {
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

  if (driver === 's3') {
    return require('./s3StorageService');
  }

  if (driver !== 'local') {
    throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
  }

  return require('./localStorageService');
}

module.exports = createStorageService();
