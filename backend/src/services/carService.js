/**
 * Car-related maintenance helpers (e.g. purge expired date blocks from booking sync).
 */
const { purgeExpired } = require('./sql/bookingSyncSqlService');
// Require the '../utils/logger' module as logger.
const logger = require('../utils/logger');

/** Remove expired car date blocks; safe to call from scheduled jobs. */
async function cleanUpOutdatedDates() {
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await purgeExpired();
    // Call logger.info to perform this step.
    logger.info('Car date blocks cleanup completed');
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'cleanUpOutdatedDates' }, 'Cleanup error (car date blocks)');
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  cleanUpOutdatedDates,
};
