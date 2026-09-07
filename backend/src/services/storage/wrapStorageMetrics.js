const metrics = require('../../monitoring/metrics');

const ASYNC_OPS = new Set([
  'storePrivateFile',
  'storePrivateBuffer',
  'openPrivateReadStream',
  'deletePrivateFile',
  'privateFileExists',
  'processUploadedFile',
  'deleteByPublicUrl',
  'openManagedPublicReadStream',
  'listManagedPublicUrls',
  'cleanupOrphans',
  'cleanupStaleTempFiles',
  'ensureTempDir',
  'ensurePrivateDir',
]);

function opName(methodName) {
  if (/delete/i.test(methodName)) return 'delete';
  if (/open|list|exists|read/i.test(methodName)) return 'read';
  if (/cleanup|ensure/i.test(methodName)) return 'cleanup';
  return 'write';
}

function wrapStorageMetrics(driverModule) {
  if (!driverModule || typeof driverModule !== 'object') {
    return driverModule;
  }

  const driver = driverModule.driver || 'unknown';
  const wrapped = Object.create(Object.getPrototypeOf(driverModule));

  for (const [key, value] of Object.entries(driverModule)) {
    if (typeof value !== 'function' || !ASYNC_OPS.has(key)) {
      wrapped[key] = value;
      continue;
    }

    wrapped[key] = async function wrappedStorageMethod(...args) {
      try {
        return await value.apply(this === wrapped ? driverModule : this, args);
      } catch (err) {
        metrics.incrementStorageErrors(driver, opName(key));
        throw err;
      }
    };
  }

  return wrapped;
}

module.exports = {
  wrapStorageMetrics,
};
