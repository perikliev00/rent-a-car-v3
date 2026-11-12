/**
 * Wrap storage driver async methods to increment storage error metrics on failure.
 * Non-async exports pass through unchanged.
 */
const metrics = require('../../monitoring/metrics');

// Create the async ops constant.
const ASYNC_OPS = new Set([
  // Supply the literal value used by the enclosing expression.
  'storePrivateFile',
  // Supply the literal value used by the enclosing expression.
  'storePrivateBuffer',
  // Supply the literal value used by the enclosing expression.
  'openPrivateReadStream',
  // Supply the literal value used by the enclosing expression.
  'deletePrivateFile',
  // Supply the literal value used by the enclosing expression.
  'privateFileExists',
  // Supply the literal value used by the enclosing expression.
  'processUploadedFile',
  // Supply the literal value used by the enclosing expression.
  'deleteByPublicUrl',
  // Supply the literal value used by the enclosing expression.
  'openManagedPublicReadStream',
  // Supply the literal value used by the enclosing expression.
  'listManagedPublicUrls',
  // Supply the literal value used by the enclosing expression.
  'cleanupOrphans',
  // Supply the literal value used by the enclosing expression.
  'cleanupStaleTempFiles',
  // Supply the literal value used by the enclosing expression.
  'ensureTempDir',
  // Supply the literal value used by the enclosing expression.
  'ensurePrivateDir',
]);

/**
 * op name.
 * @param {string} methodName
 * @returns {*}
 */
function opName(methodName) {
  // Evaluate the condition and enter the branch when it is true.
  if (/delete/i.test(methodName)) return 'delete';
  // Evaluate the condition and enter the branch when it is true.
  if (/open|list|exists|read/i.test(methodName)) return 'read';
  // Evaluate the condition and enter the branch when it is true.
  if (/cleanup|ensure/i.test(methodName)) return 'cleanup';
  // Return the resulting value to the caller.
  return 'write';
}

/**
 * @param {object} driverModule - Storage driver exports
 * @returns {object} Proxy-like wrapped module
 */
function wrapStorageMetrics(driverModule) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!driverModule || typeof driverModule !== 'object') {
    // Return the resulting value to the caller.
    return driverModule;
  }

  // Create the driver constant.
  const driver = driverModule.driver || 'unknown';
  // Create the wrapped constant.
  const wrapped = Object.create(Object.getPrototypeOf(driverModule));

  // Iterate using the loop initializer, condition, and step.
  for (const [key, value] of Object.entries(driverModule)) {
    // Guard: early-return or throw when required input is missing/invalid.
    if (typeof value !== 'function' || !ASYNC_OPS.has(key)) {
      // Update wrapped[key] with the right-hand side value.
      wrapped[key] = value;
      // Continue with the next loop iteration.
      continue;
    }

    // Update wrapped[key] with the right-hand side value.
    wrapped[key] = async function wrappedStorageMethod(...args) {
      // Start a try block for operations that may fail.
      try {
        // Return the resulting value to the caller.
        return await value.apply(this === wrapped ? driverModule : this, args);
      // Continue the surrounding logic with this statement.
      } catch (err) {
        // Call metrics.incrementStorageErrors to perform this step.
        metrics.incrementStorageErrors(driver, opName(key));
        // Throw an error to stop the current control flow.
        throw err;
      }
    };
  }

  // Return the resulting value to the caller.
  return wrapped;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  wrapStorageMetrics,
};
