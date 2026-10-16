/**
 * Car-related maintenance helpers (e.g. purge expired date blocks from booking sync).
 */
const { purgeExpired } = require('./sql/bookingSyncSqlService');
const logger = require('../utils/logger');

/** Remove expired car date blocks; safe to call from scheduled jobs. */
async function cleanUpOutdatedDates() {
  // Protected block: isolate failure modes.
  try {
    await purgeExpired();
    logger.info('Car date blocks cleanup completed');
  } catch (err) {
    logger.error({ err, context: 'cleanUpOutdatedDates' }, 'Cleanup error (car date blocks)');
  }
}

module.exports = {
  cleanUpOutdatedDates,
};
