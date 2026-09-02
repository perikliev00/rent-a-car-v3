const reservationRepository = require('../../../repositories/reservationRepository');
const reservationSql = require('../../sql/reservationSqlService');
const orderSql = require('../../sql/orderSqlService');
const refundOpSql = require('../../sql/refundOperationSqlService');
const { runWithTransaction } = require('../../../db/transaction');
const { resolvePaymentIntentForReservation } = require('./resolvePaymentIntent');
const { refundError } = require('./refundErrors');
const {
  REFUNDABLE_STATUSES,
  buildIdempotencyKey,
  parseAttemptFromIdempotencyKey,
  assertRefundableStatus,
  requireSucceededLedgerForRefunded,
  amountCentsFromReservation,
} = require('./refundPolicy');
const {
  persistPaymentIntentIfNeeded,
  persistPaidAmountIfNeeded,
  createPendingOperation,
} = require('./refundLedgerService');
const { applySucceededRefund } = require('./applyRefundService');
const { applyRefundFromStripeObject } = require('./refundWebhookService');
const { reconcilePendingRefunds } = require('./refundReconcileService');
const { succeededResponse } = require('./refundAttemptLock');
const { driveStripeForOperation } = require('./refundStripeDriver');

async function requestReservationRefund(req, { reservationId, reason = null }) {
  const reservation = await reservationRepository.findById(reservationId);
  if (!reservation) {
    throw refundError('NOT_FOUND', 'Reservation not found.', 404);
  }

  if (reservation.status === 'refunded') {
    const existing = await refundOpSql.findActiveByReservationId(reservation.id);
    requireSucceededLedgerForRefunded(reservation, existing);
    return {
      status: 'succeeded',
      refundOperation: existing,
      reservation,
      idempotent: true,
    };
  }

  const resolved = await resolvePaymentIntentForReservation(reservation);
  const paymentIntentId = resolved.paymentIntentId;
  const currency = resolved.currency || 'eur';
  const order = await orderSql.findOrderByReservationId(reservation.id);
  const requestedByUserId = req?.session?.user?.id ?? null;

  const reserved = await runWithTransaction(async (tx) => {
    const locked = await reservationSql.findByIdForUpdate(reservationId, tx);
    if (!locked) {
      throw refundError('NOT_FOUND', 'Reservation not found.', 404);
    }

    if (locked.status === 'refunded') {
      const existing = await refundOpSql.findActiveByReservationId(locked.id, tx);
      requireSucceededLedgerForRefunded(locked, existing);
      return {
        done: true,
        status: 'succeeded',
        refundOperation: existing,
        reservation: locked,
        idempotent: true,
      };
    }

    assertRefundableStatus(locked.status);
    await persistPaymentIntentIfNeeded(locked, paymentIntentId, tx);
    await persistPaidAmountIfNeeded(
      locked,
      {
        paidAmountCents: resolved.paidAmountCents,
        paidCurrency: resolved.currency,
      },
      tx
    );

    let op = await refundOpSql.findActiveByReservationId(locked.id, tx);
    if (op?.status === 'succeeded') {
      return {
        done: true,
        status: 'succeeded',
        refundOperation: op,
        reservation: locked,
        idempotent: true,
      };
    }

    if (!op) {
      const amountCents = amountCentsFromReservation(locked, resolved);
      const latest = await refundOpSql.findLatestByReservationId(locked.id, tx);
      if (!latest) {
        op = await createPendingOperation({
          reservation: locked,
          order,
          paymentIntentId,
          amountCents,
          currency,
          reason,
          requestedByUserId,
          attempt: 1,
          client: tx,
        });
      } else if (latest.status === 'failed' && latest.stripeRefundId) {
        op = latest;
      } else if (latest.status === 'failed') {
        const nextAttempt = parseAttemptFromIdempotencyKey(latest.idempotencyKey) + 1;
        if (nextAttempt > 5) {
          throw refundError('REFUND_FAILED', 'Stripe refund failed after maximum attempts.');
        }
        op = await createPendingOperation({
          reservation: locked,
          order,
          paymentIntentId,
          amountCents,
          currency,
          reason,
          requestedByUserId,
          attempt: nextAttempt,
          client: tx,
        });
      } else {
        op = await createPendingOperation({
          reservation: locked,
          order,
          paymentIntentId,
          amountCents,
          currency,
          reason,
          requestedByUserId,
          attempt: 1,
          client: tx,
        });
      }
    }

    return { done: false, reservation: locked, op };
  });

  if (reserved.done) {
    return succeededResponse(reserved);
  }

  const amountCents =
    reserved.op.amountCents != null
      ? reserved.op.amountCents
      : amountCentsFromReservation(reserved.reservation, resolved);

  const stripeCtx = {
    req,
    reservation: reserved.reservation,
    reason,
    requestedByUserId,
    amountCents,
    paymentIntentId,
    currency: resolved.currency || reserved.op.currency || 'eur',
    order,
  };

  return driveStripeForOperation(reserved.op, stripeCtx);
}

module.exports = {
  REFUNDABLE_STATUSES,
  buildIdempotencyKey,
  requestReservationRefund,
  applySucceededRefund,
  applyRefundFromStripeObject,
  reconcilePendingRefunds,
};
