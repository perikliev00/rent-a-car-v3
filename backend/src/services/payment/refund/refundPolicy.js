/**
 * Refund business rules: which reservation statuses may refund, idempotency key
 * shapes, amount resolution, and classification of Stripe errors as determinate
 * vs indeterminate (timeout after possible success → leave pending / reconcile).
 */
const logger = require('../../../utils/logger');
const { refundError } = require('./refundErrors');

/** Statuses from which a full refund may be initiated (excluding paid-cancelled). */
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
 * True when the reservation row shows captured payment (PI id or stored paid amount).
 * Unpaid holds that were cancelled have neither and must not become refundable.
 *
 * @param {object|null|undefined} reservation
 * @returns {boolean}
 */
function hasCapturedPayment(reservation) {
  if (!reservation) {
    return false;
  }
  const paymentIntentId = reservation.stripePaymentIntentId ?? reservation.stripe_payment_intent_id;
  if (paymentIntentId && String(paymentIntentId).trim()) {
    return true;
  }
  const paidAmount = Number(reservation.paidAmountCents ?? reservation.paid_amount_cents);
  return Number.isFinite(paidAmount) && paidAmount > 0;
}

/**
 * Refundable when in REFUNDABLE_STATUSES, or cancelled after payment was captured.
 *
 * @param {object|null|undefined} reservation
 * @returns {boolean}
 */
function isRefundableReservation(reservation) {
  if (!reservation) {
    return false;
  }
  if (REFUNDABLE_STATUSES.includes(reservation.status)) {
    return true;
  }
  return reservation.status === 'cancelled' && hasCapturedPayment(reservation);
}

/**
 * @param {object|string} statusOrReservation - Reservation row, or a status string
 * @param {object} [reservation] - Reservation row when the first argument is a status string
 * @throws {Error} REFUND_NOT_ALLOWED when the reservation is not refundable
 */
function assertRefundableStatus(statusOrReservation, reservation) {
  const subject =
    statusOrReservation && typeof statusOrReservation === 'object'
      ? statusOrReservation
      : { ...(reservation || {}), status: statusOrReservation };
  const status = subject.status;
  // Status / lifecycle guard before mutating domain state.
  if (!isRefundableReservation(subject)) {
    const hint =
      status === 'cancelled'
        ? ' Cancelled reservations are refundable only when a payment was captured.'
        : '';
    throw refundError(
      'REFUND_NOT_ALLOWED',
      `Cannot refund reservation in status "${status}". Allowed: ${REFUNDABLE_STATUSES.join(', ')}.${hint}`
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
  hasCapturedPayment,
  isRefundableReservation,
  assertRefundableStatus,
  isAllowedDuringPendingRefund,
  requireSucceededLedgerForRefunded,
  amountCentsFromReservation,
};
