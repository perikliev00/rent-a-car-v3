/**
 * Shared constants and re-exports used across admin order create/update/restore.
 */
const { runWithOptionalTransaction } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { OrderFormError, OrderRestoreError } = require('./orderErrors');

// Create the contact required message constant.
const CONTACT_REQUIRED_MESSAGE =
  // Supply the literal value used by the enclosing expression.
  'Full name, phone number, email, and address are required.';
// Create the reservation conflict message constant.
const RESERVATION_CONFLICT_MESSAGE =
  // Supply the literal value used by the enclosing expression.
  'Selected car currently has an active online reservation in this period. Please choose different dates or wait until the hold expires.';

/**
 * Lazy-require wrapper to avoid circular imports with orderDomainService.
 * @param {string} pickupDate
 * @param {string} pickupTime
 * @param {string} returnDate
 * @param {string} returnTime
 */
function parseDateRange(pickupDate, pickupTime, returnDate, returnTime) {
  // Destructure object properties into local variables.
  const { parseOrderDateRange } = require('./orderDomainService');
  // Return the resulting value to the caller.
  return parseOrderDateRange(pickupDate, pickupTime, returnDate, returnTime);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  CONTACT_REQUIRED_MESSAGE,
  // Contribute this line to the enclosing declaration or statement.
  RESERVATION_CONFLICT_MESSAGE,
  // Contribute this line to the enclosing declaration or statement.
  OrderFormError,
  // Contribute this line to the enclosing declaration or statement.
  OrderRestoreError,
  // Contribute this line to the enclosing declaration or statement.
  runWithOptionalTransaction,
  // Contribute this line to the enclosing declaration or statement.
  parseDateRange,
};
