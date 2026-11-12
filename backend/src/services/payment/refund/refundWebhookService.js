/**
 * Apply Stripe refund/charge webhook payloads to the local refund ledger.
 * Only full amount+currency matches drive domain refunded; partials are ignored
 * so operators can handle them manually without corrupting the ledger.
 */
const refundOpSql = require('../../sql/refundOperationSqlService');
// Destructure object properties into local variables.
const { logSystemAction } = require('../../admin/adminAuditService');
// Require the '../../../utils/logger' module as logger.
const logger = require('../../../utils/logger');
// Destructure object properties into local variables.
const { applySucceededRefund } = require('./applyRefundService');
// Destructure object properties into local variables.
const { markRefundFailed } = require('./refundLedgerService');

/**
 * extract refund id.
 * @param {*} stripeObject
 * @returns {*}
 */
function extractRefundId(stripeObject) {
  // Return the resulting value to the caller.
  return stripeObject?.object === 'refund' ? stripeObject.id : stripeObject?.refund || null;
}

/**
 * extract payment intent id.
 * @param {*} stripeObject
 * @returns {*}
 */
function extractPaymentIntentId(stripeObject) {
  // Return the resulting value to the caller.
  return typeof stripeObject?.payment_intent === 'string'
    // Contribute this line to the enclosing declaration or statement.
    ? stripeObject.payment_intent
    // Contribute this line to the enclosing declaration or statement.
    : stripeObject?.payment_intent?.id || null;
}

/**
 * amounts equal.
 * @param {*} a
 * @param {*} b
 * @returns {*}
 */
function amountsEqual(a, b) {
  // Create the na constant.
  const na = Number(a);
  // Create the nb constant.
  const nb = Number(b);
  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return false;
  }
  // Return the resulting value to the caller.
  return String(objectCurrency).toLowerCase() === String(opCurrency || '').toLowerCase();
}

/**
 * Whether the Stripe object represents a full refund matching the ledger op.
 * Partial refunds return false so domain status is not flipped incorrectly.
 */
function isFullSucceededRefund(stripeObject, op) {
  // Stripe / payment-related branch.
  if (!stripeObject || !op) {
    // Return the resulting value to the caller.
    return false;
  }

  // Stripe / payment-related branch.
  if (stripeObject.object === 'refund') {
    // Status / lifecycle guard before mutating domain state.
    if (stripeObject.status !== 'succeeded') {
      // Return the resulting value to the caller.
      return false;
    }
    // Stripe / payment-related branch.
    if (!amountsEqual(stripeObject.amount, op.amountCents)) {
      // Return the resulting value to the caller.
      return false;
    }
    // Stripe / payment-related branch.
    if (!currenciesEqual(stripeObject.currency, op.currency)) {
      // Return the resulting value to the caller.
      return false;
    }
    // Create the payment intent id constant.
    const paymentIntentId = extractPaymentIntentId(stripeObject);
    // Stripe / payment-related branch.
    if (!paymentIntentId || !op.stripePaymentIntentId) {
      // Return the resulting value to the caller.
      return false;
    }
    // Return the resulting value to the caller.
    return String(paymentIntentId) === String(op.stripePaymentIntentId);
  }

  // Stripe / payment-related branch.
  if (stripeObject.object === 'charge') {
    // Status / lifecycle guard before mutating domain state.
    if (stripeObject.refunded !== true) {
      // Return the resulting value to the caller.
      return false;
    }
    // charge.refunded with amount_refunded === amount means fully refunded.
    if (!amountsEqual(stripeObject.amount_refunded, stripeObject.amount)) {
      // Return the resulting value to the caller.
      return false;
    }
    // Stripe / payment-related branch.
    if (!amountsEqual(stripeObject.amount, op.amountCents)) {
      // Return the resulting value to the caller.
      return false;
    }
    // Status / lifecycle guard before mutating domain state.
    if (!amountsEqual(stripeObject.amount_refunded, op.amountCents)) {
      // Return the resulting value to the caller.
      return false;
    }
    // Stripe / payment-related branch.
    if (!currenciesEqual(stripeObject.currency, op.currency)) {
      // Return the resulting value to the caller.
      return false;
    }
    // Create the payment intent id constant.
    const paymentIntentId = extractPaymentIntentId(stripeObject);
    // Stripe / payment-related branch.
    if (paymentIntentId && String(paymentIntentId) !== String(op.stripePaymentIntentId || '')) {
      // Return the resulting value to the caller.
      return false;
    }
    // Return the resulting value to the caller.
    return true;
  }

  // Return the resulting value to the caller.
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
  // Call logger.warn to perform this step.
  logger.warn(
    {
      // Contribute this line to the enclosing declaration or statement.
      eventType,
      // Contribute this line to the enclosing declaration or statement.
      refundId,
      // Contribute this line to the enclosing declaration or statement.
      paymentIntentId,
      // Provide the stripe amount field value.
      stripeAmount: stripeObject?.amount ?? null,
      // Provide the stripe amount refunded field value.
      stripeAmountRefunded: stripeObject?.amount_refunded ?? null,
      // Provide the stripe currency field value.
      stripeCurrency: stripeObject?.currency ?? null,
      // Provide the stripe refunded field value.
      stripeRefunded: stripeObject?.refunded ?? null,
      // Provide the ledger amount cents field value.
      ledgerAmountCents: op?.amountCents ?? null,
      // Provide the ledger currency field value.
      ledgerCurrency: op?.currency ?? null,
    },
    // Supply the literal value used by the enclosing expression.
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
  // Create the refund id constant.
  const refundId = extractRefundId(stripeObject);
  // Create the payment intent id constant.
  const paymentIntentId = extractPaymentIntentId(stripeObject);

  // Create the op constant.
  const op =
    // Continue the surrounding logic with this statement.
    (refundId && (await refundOpSql.findByStripeRefundId(refundId))) ||
    // Continue the surrounding logic with this statement.
    (paymentIntentId && (await refundOpSql.findByPaymentIntentId(paymentIntentId))) ||
    // Supply the literal value used by the enclosing expression.
    null;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!op) {
    // Call logger.info to perform this step.
    logger.info(
      // Contribute this line to the enclosing declaration or statement.
      { eventType, refundId, paymentIntentId },
      // Supply the literal value used by the enclosing expression.
      'Refund webhook with no matching refund_operations row'
    );
    // Return the resulting value to the caller.
    return { handled: false, reason: 'no_matching_operation' };
  }

  // Stripe / payment-related branch.
  if (isFullSucceededRefund(stripeObject, op)) {
    // Create the result constant.
    const result = await applySucceededRefund({
      // Provide the refund operation field value.
      refundOperation: op,
      // Provide the reservation id field value.
      reservationId: op.reservationId,
      // Provide the reason field value.
      reason: eventType || 'stripe_refund_webhook',
      // Provide the actor field value.
      actor: { type: 'system' },
      // Provide the stripe refund field value.
      stripeRefund: {
        // Provide the id field value.
        id: refundId || op.stripeRefundId,
        // Provide the status field value.
        status: 'succeeded',
      },
    });
    // Wait until the asynchronous operation resolves.
    await logSystemAction({
      // Provide the action field value.
      action: 'system.refunded_reservation_from_stripe',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: op.reservationId,
      // Provide the metadata field value.
      metadata: { refundOperationId: op.id, eventType, stripeRefundId: refundId },
    });
    // Return the resulting value to the caller.
    return { handled: true, ...result };
  }

  // Create the is refund object constant.
  const isRefundObject = stripeObject?.object === 'refund';
  // Create the is charge object constant.
  const isChargeObject = stripeObject?.object === 'charge';

  // Status / lifecycle guard before mutating domain state.
  if (isRefundObject && (stripeObject.status === 'failed' || stripeObject.status === 'canceled')) {
    // Status / lifecycle guard before mutating domain state.
    if (op.status !== 'succeeded') {
      // Wait until the asynchronous operation resolves.
      await markRefundFailed(op, {
        // Provide the code field value.
        code: stripeObject.status,
        // Provide the message field value.
        message: `Stripe refund ${stripeObject.status}`,
      });
    }
    // Return the resulting value to the caller.
    return { handled: true, status: 'failed', refundOperation: op };
  }

  // Status / lifecycle guard before mutating domain state.
  if ((isRefundObject && stripeObject.status === 'succeeded') || isChargeObject) {
    // Call logPartialOrAmountMismatch to perform this step.
    logPartialOrAmountMismatch(stripeObject, op, { eventType, refundId, paymentIntentId });
    // Return the resulting value to the caller.
    return { handled: false, reason: 'partial_or_amount_mismatch' };
  }

  // Return the resulting value to the caller.
  return { handled: true, status: 'pending', refundOperation: op };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  applyRefundFromStripeObject,
  // Contribute this line to the enclosing declaration or statement.
  isFullSucceededRefund,
};
