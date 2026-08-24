const refundOpSql = require('../../sql/refundOperationSqlService');
const { logSystemAction } = require('../../admin/adminAuditService');
const logger = require('../../../utils/logger');
const { applySucceededRefund } = require('./applyRefundService');
const { markRefundFailed } = require('./refundLedgerService');

function extractRefundId(stripeObject) {
  return stripeObject?.object === 'refund' ? stripeObject.id : stripeObject?.refund || null;
}

function extractPaymentIntentId(stripeObject) {
  return typeof stripeObject?.payment_intent === 'string'
    ? stripeObject.payment_intent
    : stripeObject?.payment_intent?.id || null;
}

function amountsEqual(a, b) {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

function currenciesEqual(objectCurrency, opCurrency) {
  if (objectCurrency == null || objectCurrency === '') {
    return false;
  }
  return String(objectCurrency).toLowerCase() === String(opCurrency || '').toLowerCase();
}

function isFullSucceededRefund(stripeObject, op) {
  if (!stripeObject || !op) {
    return false;
  }

  if (stripeObject.object === 'refund') {
    if (stripeObject.status !== 'succeeded') {
      return false;
    }
    if (!amountsEqual(stripeObject.amount, op.amountCents)) {
      return false;
    }
    if (!currenciesEqual(stripeObject.currency, op.currency)) {
      return false;
    }
    const paymentIntentId = extractPaymentIntentId(stripeObject);
    if (!paymentIntentId || !op.stripePaymentIntentId) {
      return false;
    }
    return String(paymentIntentId) === String(op.stripePaymentIntentId);
  }

  if (stripeObject.object === 'charge') {
    if (stripeObject.refunded !== true) {
      return false;
    }
    if (!amountsEqual(stripeObject.amount_refunded, stripeObject.amount)) {
      return false;
    }
    if (!amountsEqual(stripeObject.amount, op.amountCents)) {
      return false;
    }
    if (!amountsEqual(stripeObject.amount_refunded, op.amountCents)) {
      return false;
    }
    if (!currenciesEqual(stripeObject.currency, op.currency)) {
      return false;
    }
    const paymentIntentId = extractPaymentIntentId(stripeObject);
    if (paymentIntentId && String(paymentIntentId) !== String(op.stripePaymentIntentId || '')) {
      return false;
    }
    return true;
  }

  return false;
}

function logPartialOrAmountMismatch(stripeObject, op, { eventType, refundId, paymentIntentId }) {
  logger.warn(
    {
      eventType,
      refundId,
      paymentIntentId,
      stripeAmount: stripeObject?.amount ?? null,
      stripeAmountRefunded: stripeObject?.amount_refunded ?? null,
      stripeCurrency: stripeObject?.currency ?? null,
      stripeRefunded: stripeObject?.refunded ?? null,
      ledgerAmountCents: op?.amountCents ?? null,
      ledgerCurrency: op?.currency ?? null,
    },
    'Stripe refund webhook partial or amount mismatch; skipping domain refund'
  );
}

async function applyRefundFromStripeObject(stripeObject, { eventType = null } = {}) {
  const refundId = extractRefundId(stripeObject);
  const paymentIntentId = extractPaymentIntentId(stripeObject);

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

  if (isFullSucceededRefund(stripeObject, op)) {
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

  const isRefundObject = stripeObject?.object === 'refund';
  const isChargeObject = stripeObject?.object === 'charge';

  if (isRefundObject && (stripeObject.status === 'failed' || stripeObject.status === 'canceled')) {
    if (op.status !== 'succeeded') {
      await markRefundFailed(op, {
        code: stripeObject.status,
        message: `Stripe refund ${stripeObject.status}`,
      });
    }
    return { handled: true, status: 'failed', refundOperation: op };
  }

  if ((isRefundObject && stripeObject.status === 'succeeded') || isChargeObject) {
    logPartialOrAmountMismatch(stripeObject, op, { eventType, refundId, paymentIntentId });
    return { handled: false, reason: 'partial_or_amount_mismatch' };
  }

  return { handled: true, status: 'pending', refundOperation: op };
}

module.exports = {
  applyRefundFromStripeObject,
  isFullSucceededRefund,
};
