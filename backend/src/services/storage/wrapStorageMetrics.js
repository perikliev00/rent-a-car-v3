/**
 * Wrap storage driver async methods to increment storage error metrics on failure.
 * Non-async exports pass through unchanged.
 */
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

/**
 * op name.
 * @param {string} methodName
 * @returns {*}
 */
function opName(methodName) {
  if (/delete/i.test(methodName)) return 'delete';
  if (/open|list|exists|read/i.test(methodName)) return 'read';
  if (/cleanup|ensure/i.test(methodName)) return 'cleanup';
  return 'write';
}

/**
 * @param {object} driverModule - Storage driver exports
 * @returns {object} Proxy-like wrapped module
 */
function wrapStorageMetrics(driverModule) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!driverModule || typeof driverModule !== 'object') {
    return driverModule;
  }

  const driver = driverModule.driver || 'unknown';
  const wrapped = Object.create(Object.getPrototypeOf(driverModule));

  for (const [key, value] of Object.entries(driverModule)) {
    // Guard: early-return or throw when required input is missing/invalid.
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
