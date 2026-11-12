/**
 * Refund business rules: which reservation statuses may refund, idempotency key
 * shapes, amount resolution, and classification of Stripe errors as determinate
 * vs indeterminate (timeout after possible success → leave pending / reconcile).
 */
const logger = require('../../../utils/logger');
// Destructure object properties into local variables.
const { refundError } = require('./refundErrors');

/** Statuses from which a full refund may be initiated. */
const REFUNDABLE_STATUSES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'paid',
  // Supply the literal value used by the enclosing expression.
  'manual_review',
  // Supply the literal value used by the enclosing expression.
  'confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_prepared',
]);

/**
 * Stripe + local ledger idempotency key for a full refund attempt.
 * @param {string|number} reservationId
 * @param {number} [attempt=1]
 * @returns {string}
 */
function buildIdempotencyKey(reservationId, attempt = 1) {
  // Evaluate the condition and enter the branch when it is true.
  if (attempt <= 1) {
    // Return the resulting value to the caller.
    return `refund:reservation:${reservationId}:full`;
  }
  // Return the resulting value to the caller.
  return `refund:reservation:${reservationId}:full:attempt${attempt}`;
}

/**
 * @param {string} status
 * @throws {Error} REFUND_NOT_ALLOWED when status is not refundable
 */
function assertRefundableStatus(status) {
  // Status / lifecycle guard before mutating domain state.
  if (!REFUNDABLE_STATUSES.includes(status)) {
    // Throw an error to stop the current control flow.
    throw refundError(
      // Supply the literal value used by the enclosing expression.
      'REFUND_NOT_ALLOWED',
      // Continue the surrounding logic with this statement.
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
  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return existing;
  }
  // Call logger.warn to perform this step.
  logger.warn(
    {
      // Provide the reservation id field value.
      reservationId: reservation?.id,
      // Provide the ledger status field value.
      ledgerStatus: existing?.status || null,
    },
    // Supply the literal value used by the enclosing expression.
    'Reservation is marked refunded but has no succeeded refund ledger row'
  );
  // Throw an error to stop the current control flow.
  throw refundError(
    // Supply the literal value used by the enclosing expression.
    'REFUND_LEDGER_INCONSISTENT',
    // Apply the TypeScript type assertion for this value.
    'Reservation is marked refunded but has no succeeded refund ledger row. Do not treat this as a Stripe refund.',
    // Supply the literal value used by the enclosing expression.
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
  // Evaluate the condition and enter the branch when it is true.
  if (resolved.amountCents === 0) {
    // Throw an error to stop the current control flow.
    throw refundError(
      // Supply the literal value used by the enclosing expression.
      'REFUND_NO_AMOUNT',
      // Supply the literal value used by the enclosing expression.
      'Cannot refund: Stripe reports no remaining refundable amount.'
    );
  }
  // Evaluate the condition and enter the branch when it is true.
  if (resolved.amountCents != null && resolved.amountCents > 0) {
    // Return the resulting value to the caller.
    return resolved.amountCents;
  }
  // Create the snapshot constant.
  const snapshot = Number(reservation.paidAmountCents);
  // Evaluate the condition and enter the branch when it is true.
  if (Number.isFinite(snapshot) && snapshot > 0) {
    // Return the resulting value to the caller.
    return snapshot;
  }
  // Throw an error to stop the current control flow.
  throw refundError('REFUND_NO_AMOUNT', 'Cannot refund: missing refundable amount.');
}

/**
 * @param {string} key
 * @returns {number}
 */
function parseAttemptFromIdempotencyKey(key) {
  // Create the match constant.
  const match = /:attempt(\d+)$/.exec(String(key || ''));
  // Evaluate the condition and enter the branch when it is true.
  if (match) {
    // Return the resulting value to the caller.
    return Number(match[1]);
  }
  // Return the resulting value to the caller.
  return 1;
}

// Create the confirmed no refund codes constant.
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
    // Return the resulting value to the caller.
    return true;
  }
  // Status / lifecycle guard before mutating domain state.
  if (err.status === 'failed' || err.status === 'canceled') {
    // Return the resulting value to the caller.
    return false;
  }
  // Stripe / payment-related branch.
  if (err.type === 'StripeInvalidRequestError') {
    // Return the resulting value to the caller.
    return false;
  }
  // Create the status code constant.
  const statusCode = Number(err.statusCode);
  // Evaluate the condition and enter the branch when it is true.
  if (
    // Update err.type with the right-hand side value.
    err.type === 'StripeAPIError' &&
    // Call CONFIRMED_NO_REFUND_CODES.has to perform this step.
    CONFIRMED_NO_REFUND_CODES.has(String(err.code || '')) &&
    // Continue the surrounding logic with this statement.
    !(statusCode >= 500)
  // Continue the surrounding logic with this statement.
  ) {
    // Return the resulting value to the caller.
    return false;
  }
  // Create the type constant.
  const type = String(err.type || '');
  // Create the code constant.
  const code = String(err.code || '');
  // Create the message constant.
  const message = String(err.message || '');
  // Stripe / payment-related branch.
  if (type === 'StripeConnectionError' || type === 'StripeTimeoutError') {
    // Return the resulting value to the caller.
    return true;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ENOTFOUND'].includes(code)) {
    // Return the resulting value to the caller.
    return true;
  }
  // Status / lifecycle guard before mutating domain state.
  if (statusCode >= 500) {
    // Return the resulting value to the caller.
    return true;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (/timeout|timed out|socket hang up/i.test(message)) {
    // Return the resulting value to the caller.
    return true;
  }
  // Status / lifecycle guard before mutating domain state.
  if (!Number.isFinite(statusCode)) {
    // Return the resulting value to the caller.
    return true;
  }
  // Return the resulting value to the caller.
  return false;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  REFUNDABLE_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  buildIdempotencyKey,
  // Contribute this line to the enclosing declaration or statement.
  parseAttemptFromIdempotencyKey,
  // Contribute this line to the enclosing declaration or statement.
  isIndeterminateStripeError,
  // Contribute this line to the enclosing declaration or statement.
  assertRefundableStatus,
  // Contribute this line to the enclosing declaration or statement.
  isAllowedDuringPendingRefund,
  // Contribute this line to the enclosing declaration or statement.
  requireSucceededLedgerForRefunded,
  // Contribute this line to the enclosing declaration or statement.
  amountCentsFromReservation,
};
