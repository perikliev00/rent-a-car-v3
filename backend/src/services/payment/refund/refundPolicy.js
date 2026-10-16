/**
 * Refund business rules: which reservation statuses may refund, idempotency key
 * shapes, amount resolution, and classification of Stripe errors as determinate
 * vs indeterminate (timeout after possible success → leave pending / reconcile).
 */
const logger = require('../../../utils/logger');
const { refundError } = require('./refundErrors');

/** Statuses from which a full refund may be initiated. */
const REFUNDABLE_STATUSES = Object.freeze([
  'paid',
  'manual_review',
  'confirmed',
  'car_prepared',
]);

/**
 * Stripe + local ledger idempotency key for a full refund attempt.
 * @param {string|number} reservationId
 * @param {number} [attempt=1]
 * @returns {string}
 */
function buildIdempotencyKey(reservationId, attempt = 1) {
  if (attempt <= 1) {
    return `refund:reservation:${reservationId}:full`;
  }
  return `refund:reservation:${reservationId}:full:attempt${attempt}`;
}

/**
 * @param {string} status
 * @throws {Error} REFUND_NOT_ALLOWED when status is not refundable
 */
function assertRefundableStatus(status) {
  // Status / lifecycle guard before mutating domain state.
  if (!REFUNDABLE_STATUSES.includes(status)) {
    throw refundError(
      'REFUND_NOT_ALLOWED',
      `Cannot refund reservation in status "${status}". Allowed: ${REFUNDABLE_STATUSES.join(', ')}.`
    );
  }
}

/**
 * While a refund is pending, only certain domain transitions remain allowed.
 * @param {string} newStatus
 * @returns {boolean}
 */
function isAllowedDuringPendingRefund(newStatus) {
  return newStatus === 'refunded' || REFUNDABLE_STATUSES.includes(newStatus);
}

/**
 * Domain says refunded must have a succeeded ledger row — otherwise data is inconsistent.
 * @param {object} reservation
 * @param {object|null} existing
 * @returns {object} succeeded ledger row
 */
function requireSucceededLedgerForRefunded(reservation, existing) {
  // Idempotency guard: return early when work was already applied.
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

/**
 * Prefer Stripe remaining amount; fall back to stored paidAmountCents.
 * @param {object} reservation
 * @param {{ amountCents?: number|null }} resolved
 * @returns {number}
 */
function amountCentsFromReservation(reservation, resolved) {
  if (resolved.amountCents === 0) {
    throw refundError(
      'REFUND_NO_AMOUNT',
      'Cannot refund: Stripe reports no remaining refundable amount.'
    );
  }
  if (resolved.amountCents != null && resolved.amountCents > 0) {
    return resolved.amountCents;
  }
  const snapshot = Number(reservation.paidAmountCents);
  if (Number.isFinite(snapshot) && snapshot > 0) {
    return snapshot;
  }
  throw refundError('REFUND_NO_AMOUNT', 'Cannot refund: missing refundable amount.');
}

/**
 * @param {string} key
 * @returns {number}
 */
function parseAttemptFromIdempotencyKey(key) {
  const match = /:attempt(\d+)$/.exec(String(key || ''));
  if (match) {
    return Number(match[1]);
  }
  return 1;
}

const CONFIRMED_NO_REFUND_CODES = new Set(['refund_failed']);

/**
 * True when Stripe may have accepted the refund despite the error (timeouts, 5xx).
 * Callers must not mark the ledger failed for indeterminate errors — reconcile instead.
 *
 * @param {Error|object|null|undefined} err
 * @returns {boolean}
 */
function isIndeterminateStripeError(err) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!err) {
    return true;
  }
  // Status / lifecycle guard before mutating domain state.
  if (err.status === 'failed' || err.status === 'canceled') {
    return false;
  }
  // Stripe / payment-related branch.
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
  // Stripe / payment-related branch.
  if (type === 'StripeConnectionError' || type === 'StripeTimeoutError') {
    return true;
  }
  if (['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ENOTFOUND'].includes(code)) {
    return true;
  }
  // Status / lifecycle guard before mutating domain state.
  if (statusCode >= 500) {
    return true;
  }
  if (/timeout|timed out|socket hang up/i.test(message)) {
    return true;
  }
  // Status / lifecycle guard before mutating domain state.
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
