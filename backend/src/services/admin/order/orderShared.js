const { runWithOptionalTransaction } = require('../../../db/transaction');
const { OrderFormError, OrderRestoreError } = require('./orderErrors');

const CONTACT_REQUIRED_MESSAGE =
  'Full name, phone number, email, and address are required.';
const RESERVATION_CONFLICT_MESSAGE =
  'Selected car currently has an active online reservation in this period. Please choose different dates or wait until the hold expires.';

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
