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
  // Create the driver constant.
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

  // Reserve the impl variable for later assignment.
  let impl;
  // Evaluate the condition and enter the branch when it is true.
  if (driver === 's3') {
    // Update impl with the right-hand side value.
    impl = require('./s3StorageService');
  // Continue the surrounding logic with this statement.
  } else if (driver !== 'local') {
    // Throw an error to stop the current control flow.
    throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Update impl with the right-hand side value.
    impl = require('./localStorageService');
  }

  // Return the resulting value to the caller.
  return wrapStorageMetrics(impl);
}

// Assign the CommonJS module exports.
module.exports = createStorageService();
