const { purgeExpired } = require('./sql/bookingSyncSqlService');
const logger = require('../utils/logger');

async function cleanUpOutdatedDates() {
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
