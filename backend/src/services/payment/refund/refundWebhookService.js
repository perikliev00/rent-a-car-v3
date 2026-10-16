/**
 * Apply Stripe refund/charge webhook payloads to the local refund ledger.
 * Only full amount+currency matches drive domain refunded; partials are ignored
 * so operators can handle them manually without corrupting the ledger.
 */
const refundOpSql = require('../../sql/refundOperationSqlService');
const { logSystemAction } = require('../../admin/adminAuditService');
const logger = require('../../../utils/logger');
const { applySucceededRefund } = require('./applyRefundService');
const { markRefundFailed } = require('./refundLedgerService');

/**
 * extract refund id.
 * @param {*} stripeObject
 * @returns {*}
 */
function extractRefundId(stripeObject) {
  return stripeObject?.object === 'refund' ? stripeObject.id : stripeObject?.refund || null;
}

/**
 * extract payment intent id.
 * @param {*} stripeObject
 * @returns {*}
 */
function extractPaymentIntentId(stripeObject) {
  return typeof stripeObject?.payment_intent === 'string'
    ? stripeObject.payment_intent
    : stripeObject?.payment_intent?.id || null;
}

/**
 * amounts equal.
 * @param {*} a
 * @param {*} b
 * @returns {*}
 */
function amountsEqual(a, b) {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

/**
 * currencies equal.
 * @param {*} objectCurrency
 * @param {*} opCurrency
 * @returns {*}
 */
function currenciesEqual(objectCurrency, opCurrency) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (objectCurrency == null || objectCurrency === '') {
    return false;
  }
  return String(objectCurrency).toLowerCase() === String(opCurrency || '').toLowerCase();
}

/**
 * Whether the Stripe object represents a full refund matching the ledger op.
 * Partial refunds return false so domain status is not flipped incorrectly.
 */
function isFullSucceededRefund(stripeObject, op) {
  // Stripe / payment-related branch.
  if (!stripeObject || !op) {
    return false;
  }

  // Stripe / payment-related branch.
  if (stripeObject.object === 'refund') {
    // Status / lifecycle guard before mutating domain state.
    if (stripeObject.status !== 'succeeded') {
      return false;
    }
    // Stripe / payment-related branch.
    if (!amountsEqual(stripeObject.amount, op.amountCents)) {
      return false;
    }
    // Stripe / payment-related branch.
    if (!currenciesEqual(stripeObject.currency, op.currency)) {
      return false;
    }
    const paymentIntentId = extractPaymentIntentId(stripeObject);
    // Stripe / payment-related branch.
    if (!paymentIntentId || !op.stripePaymentIntentId) {
      return false;
    }
    return String(paymentIntentId) === String(op.stripePaymentIntentId);
  }

  // Stripe / payment-related branch.
  if (stripeObject.object === 'charge') {
    // Status / lifecycle guard before mutating domain state.
    if (stripeObject.refunded !== true) {
      return false;
    }
    // charge.refunded with amount_refunded === amount means fully refunded.
    if (!amountsEqual(stripeObject.amount_refunded, stripeObject.amount)) {
      return false;
    }
    // Stripe / payment-related branch.
    if (!amountsEqual(stripeObject.amount, op.amountCents)) {
      return false;
    }
    // Status / lifecycle guard before mutating domain state.
    if (!amountsEqual(stripeObject.amount_refunded, op.amountCents)) {
      return false;
    }
    // Stripe / payment-related branch.
    if (!currenciesEqual(stripeObject.currency, op.currency)) {
      return false;
    }
    const paymentIntentId = extractPaymentIntentId(stripeObject);
    // Stripe / payment-related branch.
    if (paymentIntentId && String(paymentIntentId) !== String(op.stripePaymentIntentId || '')) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * log partial or amount mismatch.
 * @param {*} stripeObject
 * @param {*} op
 * @param {*} { eventType
 * @param {string|number} refundId
 * @param {*} paymentIntentId }
 * @returns {*}
 */
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

/**
 * Match webhook object to a refund_operations row and apply success/failure.
 *
 * @param {object} stripeObject - Stripe Refund or Charge
 * @param {{ eventType?: string|null }} [options]
 * @returns {Promise<object>}
 */
async function applyRefundFromStripeObject(stripeObject, { eventType = null } = {}) {
  const refundId = extractRefundId(stripeObject);
  const paymentIntentId = extractPaymentIntentId(stripeObject);

  const op =
    (refundId && (await refundOpSql.findByStripeRefundId(refundId))) ||
    (paymentIntentId && (await refundOpSql.findByPaymentIntentId(paymentIntentId))) ||
    null;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!op) {
    logger.info(
      { eventType, refundId, paymentIntentId },
      'Refund webhook with no matching refund_operations row'
    );
    return { handled: false, reason: 'no_matching_operation' };
  }

  // Stripe / payment-related branch.
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

  // Status / lifecycle guard before mutating domain state.
  if (isRefundObject && (stripeObject.status === 'failed' || stripeObject.status === 'canceled')) {
    // Status / lifecycle guard before mutating domain state.
    if (op.status !== 'succeeded') {
      await markRefundFailed(op, {
        code: stripeObject.status,
        message: `Stripe refund ${stripeObject.status}`,
      });
    }
    return { handled: true, status: 'failed', refundOperation: op };
  }

  // Status / lifecycle guard before mutating domain state.
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
