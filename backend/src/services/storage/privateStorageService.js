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
  // Create the driver constant.
  const driver = (process.env.PRIVATE_STORAGE_DRIVER || 'local').toLowerCase();

  // Reserve the impl variable for later assignment.
  let impl;
  // Evaluate the condition and enter the branch when it is true.
  if (driver === 's3') {
    // Update impl with the right-hand side value.
    impl = require('./privateS3StorageService');
  // Continue the surrounding logic with this statement.
  } else if (driver !== 'local') {
    // Throw an error to stop the current control flow.
    throw new Error(`Unsupported PRIVATE_STORAGE_DRIVER: ${driver}`);
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Update impl with the right-hand side value.
    impl = require('./privateLocalStorageService');
  }

  // Return the resulting value to the caller.
  return wrapStorageMetrics(impl);
}

// Assign the CommonJS module exports.
module.exports = createPrivateStorageService();
