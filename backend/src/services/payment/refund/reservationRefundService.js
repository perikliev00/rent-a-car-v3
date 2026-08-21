const reservationRepository = require('../../../repositories/reservationRepository');
const orderSql = require('../../sql/orderSqlService');
const refundOpSql = require('../../sql/refundOperationSqlService');
const { createRefund, retrieveRefund } = require('../stripeRefundService');
const {
  resolvePaymentIntentForReservation,
  refundError,
} = require('./resolvePaymentIntent');
const { logAdminAction } = require('../../admin/adminAuditService');
const logger = require('../../../utils/logger');
const {
  REFUNDABLE_STATUSES,
  buildIdempotencyKey,
  assertRefundableStatus,
  amountCentsFromReservation,
} = require('./refundPolicy');
const {
  persistPaymentIntentIfNeeded,
  markRefundFailed,
  createPendingOperation,
} = require('./refundLedgerService');
const { applySucceededRefund } = require('./applyRefundService');
const { applyRefundFromStripeObject } = require('./refundWebhookService');
const { reconcilePendingRefunds } = require('./refundReconcileService');

async function requestReservationRefund(req, { reservationId, reason = null }) {
  const reservation = await reservationRepository.findById(reservationId);
  if (!reservation) {
    throw refundError('NOT_FOUND', 'Reservation not found.', 404);
  }

  if (reservation.status === 'refunded') {
    const existing = await refundOpSql.findActiveByReservationId(reservation.id);
    return {
      status: 'succeeded',
      refundOperation: existing,
      reservation,
      idempotent: true,
    };
  }

  assertRefundableStatus(reservation.status);

  const resolved = await resolvePaymentIntentForReservation(reservation);
  const paymentIntentId = resolved.paymentIntentId;
  await persistPaymentIntentIfNeeded(reservation, paymentIntentId);

  const amountCents = amountCentsFromReservation(reservation, resolved);
  const currency = resolved.currency || 'eur';
  const order = await orderSql.findOrderByReservationId(reservation.id);
  const requestedByUserId = req?.session?.user?.id ?? null;

  let op = await refundOpSql.findActiveByReservationId(reservation.id);
  if (op?.status === 'succeeded') {
    const latest = await reservationRepository.findById(reservation.id);
    return {
      status: 'succeeded',
      refundOperation: op,
      reservation: latest,
      idempotent: true,
    };
  }

  if (!op) {
    op = await createPendingOperation({
      reservation,
      order,
      paymentIntentId,
      amountCents,
      currency,
      reason,
      requestedByUserId,
    });
  }

  if (op.status === 'pending' && op.stripeRefundId) {
    try {
      const existingRefund = await retrieveRefund(op.stripeRefundId);
      if (existingRefund.status === 'succeeded') {
        return applySucceededRefund({
          refundOperation: op,
          reservationId: reservation.id,
          reason: reason || 'stripe_refund_retrieved',
          actor: {
            type: 'admin',
            req,
            userId: requestedByUserId,
          },
          stripeRefund: existingRefund,
        });
      }
      if (existingRefund.status === 'failed' || existingRefund.status === 'canceled') {
        await markRefundFailed(op, {
          code: existingRefund.status,
          message: `Stripe refund ${existingRefund.status}`,
        });
        throw refundError('REFUND_FAILED', `Stripe refund ${existingRefund.status}.`);
      }
      return {
        status: 'pending',
        refundOperation: await refundOpSql.findActiveByReservationId(reservation.id),
        reservation: await reservationRepository.findById(reservation.id),
      };
    } catch (err) {
      if (err.code === 'REFUND_FAILED') throw err;
      logger.warn(
        { err, refundId: op.stripeRefundId, reservationId: reservation.id },
        'Failed to retrieve existing Stripe refund'
      );
    }
  }

  let stripeRefund;
  try {
    stripeRefund = await createRefund({
      paymentIntentId,
      amountCents,
      idempotencyKey: op.idempotencyKey,
    });
  } catch (err) {
    await markRefundFailed(op, err);
    throw refundError('REFUND_FAILED', err.message || 'Stripe refund failed.');
  }

  op = await refundOpSql.updateRefundOperation(op.id, {
    stripeRefundId: stripeRefund.id,
    stripeRawStatus: stripeRefund.status,
  });

  if (stripeRefund.status === 'succeeded') {
    const applied = await applySucceededRefund({
      refundOperation: op,
      reservationId: reservation.id,
      reason: reason || 'admin_stripe_refund',
      actor: {
        type: 'admin',
        req,
        userId: requestedByUserId,
      },
      stripeRefund,
    });

    try {
      if (req) {
        await logAdminAction(req, {
          action: 'admin.refunded_reservation',
          entityType: 'reservation',
          entityId: reservation.id,
          metadata: {
            refundOperationId: applied.refundOperation?.id,
            stripeRefundId: stripeRefund.id,
            amountCents,
          },
        });
      }
    } catch (err) {
      logger.error({ err, context: 'requestReservationRefund.audit' }, 'Refund audit failed');
    }

    return applied;
  }

  if (stripeRefund.status === 'failed' || stripeRefund.status === 'canceled') {
    await markRefundFailed(op, {
      code: stripeRefund.status,
      message: `Stripe refund ${stripeRefund.status}`,
    });
    throw refundError('REFUND_FAILED', `Stripe refund ${stripeRefund.status}.`);
  }

  return {
    status: 'pending',
    refundOperation: op,
    reservation: await reservationRepository.findById(reservation.id),
  };
}

module.exports = {
  REFUNDABLE_STATUSES,
  buildIdempotencyKey,
  requestReservationRefund,
  applySucceededRefund,
  applyRefundFromStripeObject,
  reconcilePendingRefunds,
};
