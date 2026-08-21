const refundOpSql = require('../../sql/refundOperationSqlService');
const { logSystemAction } = require('../../admin/adminAuditService');
const logger = require('../../../utils/logger');
const { applySucceededRefund } = require('./applyRefundService');
const { markRefundFailed } = require('./refundLedgerService');

async function applyRefundFromStripeObject(stripeObject, { eventType = null } = {}) {
  const refundId = stripeObject?.object === 'refund' ? stripeObject.id : stripeObject?.refund || null;
  const paymentIntentId =
    typeof stripeObject?.payment_intent === 'string'
      ? stripeObject.payment_intent
      : stripeObject?.payment_intent?.id || null;

  const op =
    (refundId && (await refundOpSql.findByStripeRefundId(refundId))) ||
    (paymentIntentId && (await refundOpSql.findByPaymentIntentId(paymentIntentId))) ||
    null;

  if (!op) {
    logger.info(
      { eventType, refundId, paymentIntentId },
      'Refund webhook with no matching refund_operations row'
    );
    return { handled: false, reason: 'no_matching_operation' };
  }

  const status =
    stripeObject?.object === 'refund'
      ? stripeObject.status
      : stripeObject?.refunded
        ? 'succeeded'
        : stripeObject?.status || null;

  if (status === 'succeeded' || stripeObject?.refunded === true) {
    const result = await applySucceededRefund({
      refundOperation: op,
      reservationId: op.reservationId,
      reason: eventType || 'stripe_refund_webhook',
      actor: { type: 'system' },
      stripeRefund: {
        id: refundId || op.stripeRefundId,
        status: 'succeeded',
      },
    });
    await logSystemAction({
      action: 'system.refunded_reservation_from_stripe',
      entityType: 'reservation',
      entityId: op.reservationId,
      metadata: { refundOperationId: op.id, eventType, stripeRefundId: refundId },
    });
    return { handled: true, ...result };
  }

  if (status === 'failed' || status === 'canceled') {
    if (op.status !== 'succeeded') {
      await markRefundFailed(op, {
        code: status,
        message: `Stripe refund ${status}`,
      });
    }
    return { handled: true, status: 'failed', refundOperation: op };
  }

  return { handled: true, status: 'pending', refundOperation: op };
}

module.exports = {
  applyRefundFromStripeObject,
};
