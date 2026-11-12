/**
 * Shared constants and re-exports used across admin order create/update/restore.
 */
const { runWithOptionalTransaction } = require('../../../db/transaction');
const { OrderFormError, OrderRestoreError } = require('./orderErrors');

const CONTACT_REQUIRED_MESSAGE =
  'Full name, phone number, email, and address are required.';
const RESERVATION_CONFLICT_MESSAGE =
  'Selected car currently has an active online reservation in this period. Please choose different dates or wait until the hold expires.';

/**
 * Lazy-require wrapper to avoid circular imports with orderDomainService.
 * @param {string} pickupDate
 * @param {string} pickupTime
 * @param {string} returnDate
 * @param {string} returnTime
 */
function parseDateRange(pickupDate, pickupTime, returnDate, returnTime) {
  const { parseOrderDateRange } = require('./orderDomainService');
  return parseOrderDateRange(pickupDate, pickupTime, returnDate, returnTime);
}

module.exports = {
  CONTACT_REQUIRED_MESSAGE,
  RESERVATION_CONFLICT_MESSAGE,
  OrderFormError,
  OrderRestoreError,
  runWithOptionalTransaction,
  parseDateRange,
};
