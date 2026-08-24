const logger = require('../../../utils/logger');
const { refundError } = require('./refundErrors');

const REFUNDABLE_STATUSES = Object.freeze([
  'paid',
  'manual_review',
  'confirmed',
  'car_prepared',
]);

function buildIdempotencyKey(reservationId, attempt = 1) {
  if (attempt <= 1) {
    return `refund:reservation:${reservationId}:full`;
  }
  return `refund:reservation:${reservationId}:full:attempt${attempt}`;
}

function assertRefundableStatus(status) {
  if (!REFUNDABLE_STATUSES.includes(status)) {
    throw refundError(
      'REFUND_NOT_ALLOWED',
      `Cannot refund reservation in status "${status}". Allowed: ${REFUNDABLE_STATUSES.join(', ')}.`
    );
  }
}

function isAllowedDuringPendingRefund(newStatus) {
  return newStatus === 'refunded' || REFUNDABLE_STATUSES.includes(newStatus);
}

function requireSucceededLedgerForRefunded(reservation, existing) {
  if (existing && existing.status === 'succeeded') {
    return existing;
  }
  logger.warn(
    {
      reservationId: reservation?.id,
      ledgerStatus: existing?.status || null,
    },
    'Reservation is marked refunded but has no succeeded refund ledger row'
  );
  throw refundError(
    'REFUND_LEDGER_INCONSISTENT',
    'Reservation is marked refunded but has no succeeded refund ledger row. Do not treat this as a Stripe refund.',
    409
  );
}

function amountCentsFromReservation(reservation, resolved) {
  if (resolved.amountCents != null && resolved.amountCents > 0) {
    return resolved.amountCents;
  }
  const price = Number(reservation.totalPrice);
  if (Number.isFinite(price) && price > 0) {
    return Math.round(price * 100);
  }
  throw refundError('REFUND_NO_AMOUNT', 'Cannot refund: missing refundable amount.');
}

function parseAttemptFromIdempotencyKey(key) {
  const match = /:attempt(\d+)$/.exec(String(key || ''));
  if (match) {
    return Number(match[1]);
  }
  return 1;
}

const CONFIRMED_NO_REFUND_CODES = new Set(['refund_failed']);

function isIndeterminateStripeError(err) {
  if (!err) {
    return true;
  }
  if (err.status === 'failed' || err.status === 'canceled') {
    return false;
  }
  if (err.type === 'StripeInvalidRequestError') {
    return false;
  }
  const statusCode = Number(err.statusCode);
  if (
    err.type === 'StripeAPIError' &&
    CONFIRMED_NO_REFUND_CODES.has(String(err.code || '')) &&
    !(statusCode >= 500)
  ) {
    return false;
  }
  const type = String(err.type || '');
  const code = String(err.code || '');
  const message = String(err.message || '');
  if (type === 'StripeConnectionError' || type === 'StripeTimeoutError') {
    return true;
  }
  if (['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ENOTFOUND'].includes(code)) {
    return true;
  }
  if (statusCode >= 500) {
    return true;
  }
  if (/timeout|timed out|socket hang up/i.test(message)) {
    return true;
  }
  if (!Number.isFinite(statusCode)) {
    return true;
  }
  return false;
}

module.exports = {
  REFUNDABLE_STATUSES,
  buildIdempotencyKey,
  parseAttemptFromIdempotencyKey,
  isIndeterminateStripeError,
  assertRefundableStatus,
  isAllowedDuringPendingRefund,
  requireSucceededLedgerForRefunded,
  amountCentsFromReservation,
};
