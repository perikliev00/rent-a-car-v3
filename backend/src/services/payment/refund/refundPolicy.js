const { refundError } = require('./resolvePaymentIntent');

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

module.exports = {
  REFUNDABLE_STATUSES,
  buildIdempotencyKey,
  assertRefundableStatus,
  amountCentsFromReservation,
};
