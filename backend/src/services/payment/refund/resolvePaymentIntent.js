/**
 * Resolve Stripe PaymentIntent id and remaining refundable amount for a reservation.
 * Prefers stored PI; falls back to Checkout Session retrieve.
 * Amount comes from Stripe remaining (or the write-once paid snapshot), never the quote.
 */
const logger = require('../../../utils/logger');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  retrieveStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  retrieveStripePaymentIntent,
// Continue the surrounding logic with this statement.
} = require('../stripeCheckoutService');
// Destructure object properties into local variables.
const { refundError } = require('./refundErrors');

/**
 * charge from payment intent.
 * @param {*} paymentIntent
 * @returns {*}
 */
function chargeFromPaymentIntent(paymentIntent) {
  // Create the charge constant.
  const charge = paymentIntent?.latest_charge;
  // Evaluate the condition and enter the branch when it is true.
  if (charge && typeof charge === 'object') {
    // Return the resulting value to the caller.
    return charge;
  }
  // Return the resulting value to the caller.
  return null;
}

/** Original captured amount in cents (for paidAmountCents backfill). */
function originalPaidCents(paymentIntent) {
  // Create the charge constant.
  const charge = chargeFromPaymentIntent(paymentIntent);
  // Evaluate the condition and enter the branch when it is true.
  if (charge) {
    // Create the captured constant.
    const captured = Number(charge.amount_captured ?? charge.amount ?? 0);
    // Evaluate the condition and enter the branch when it is true.
    if (Number.isFinite(captured) && captured > 0) {
      // Return the resulting value to the caller.
      return captured;
    }
  }

  // Create the received constant.
  const received = Number(paymentIntent?.amount_received ?? paymentIntent?.amount ?? 0);
  // Return the resulting value to the caller.
  return Number.isFinite(received) && received > 0 ? received : null;
}

/** Remaining refundable cents after prior refunds (from expanded latest_charge). */
function remainingRefundableCents(paymentIntent) {
  // Create the charge constant.
  const charge = chargeFromPaymentIntent(paymentIntent);
  // Evaluate the condition and enter the branch when it is true.
  if (charge) {
    // Create the captured constant.
    const captured = Number(charge.amount_captured ?? charge.amount ?? 0);
    // Create the refunded constant.
    const refunded = Number(charge.amount_refunded ?? 0);
    // Status / lifecycle guard before mutating domain state.
    if (Number.isFinite(captured) && Number.isFinite(refunded)) {
      // Return the resulting value to the caller.
      return Math.max(0, captured - refunded);
    }
  }

  // Create the received constant.
  const received = Number(paymentIntent?.amount_received ?? paymentIntent?.amount ?? 0);
  // Return the resulting value to the caller.
  return Number.isFinite(received) ? Math.max(0, received) : null;
}

/**
 * snapshot amount cents.
 * @param {object} reservation
 * @returns {*}
 */
function snapshotAmountCents(reservation) {
  // Create the cents constant.
  const cents = Number(reservation?.paidAmountCents);
  // Return the resulting value to the caller.
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/**
 * Resolve payment intent id from checkout session from inputs / Stripe / DB.
 * @param {object} reservation
 * @returns {Promise<*>}
 */
async function resolvePaymentIntentIdFromCheckoutSession(reservation) {
  // Create the session id constant.
  const sessionId = reservation?.stripeSessionId;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!sessionId) {
    // Throw an error to stop the current control flow.
    throw refundError(
      // Supply the literal value used by the enclosing expression.
      'REFUND_NO_PAYMENT_INTENT',
      // Supply the literal value used by the enclosing expression.
      'Cannot refund: reservation has no Stripe Payment Intent or Checkout Session.'
    );
  }

  // Reserve the session variable for later assignment.
  let session;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in session.
    session = await retrieveStripeCheckoutSession(sessionId);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Throw an error to stop the current control flow.
    throw refundError(
      // Supply the literal value used by the enclosing expression.
      'REFUND_NO_PAYMENT_INTENT',
      // Continue the surrounding logic with this statement.
      `Cannot refund: failed to retrieve Checkout Session (${err.message}).`
    );
  }

  // Create the pi constant.
  const pi =
    // Continue the surrounding logic with this statement.
    typeof session.payment_intent === 'string'
      // Contribute this line to the enclosing declaration or statement.
      ? session.payment_intent
      // Contribute this line to the enclosing declaration or statement.
      : session.payment_intent?.id || null;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!pi) {
    // Throw an error to stop the current control flow.
    throw refundError(
      // Supply the literal value used by the enclosing expression.
      'REFUND_NO_PAYMENT_INTENT',
      // Supply the literal value used by the enclosing expression.
      'Cannot refund: Checkout Session has no Payment Intent.'
    );
  }

  // Create the amount total constant.
  const amountTotal =
    // Continue the surrounding logic with this statement.
    session.amount_total != null && Number.isFinite(Number(session.amount_total))
      // Continue the surrounding logic with this statement.
      ? Number(session.amount_total)
      // Contribute this line to the enclosing declaration or statement.
      : null;

  // Return the resulting value to the caller.
  return {
    // Provide the payment intent id field value.
    paymentIntentId: String(pi),
    // Provide the amount cents field value.
    amountCents: amountTotal,
    // Provide the currency field value.
    currency: session.currency || null,
    // Provide the source field value.
    source: 'checkout_session',
  };
}

/**
 * Resolve from payment intent from inputs / Stripe / DB.
 * @param {string|number} paymentIntentId
 * @returns {Promise<*>}
 */
async function resolveFromPaymentIntent(paymentIntentId) {
  // Create the payment intent constant.
  const paymentIntent = await retrieveStripePaymentIntent(paymentIntentId);
  // Create the remaining constant.
  const remaining = remainingRefundableCents(paymentIntent);
  // Create the paid constant.
  const paid = originalPaidCents(paymentIntent);

  // Return the resulting value to the caller.
  return {
    // Provide the payment intent id field value.
    paymentIntentId: String(paymentIntentId),
    // Provide the amount cents field value.
    amountCents: remaining,
    // Provide the currency field value.
    currency: paymentIntent.currency || null,
    // Provide the source field value.
    source: 'stripe_pi',
    // Provide the paid amount cents field value.
    paidAmountCents: paid,
  };
}

/**
 * Resolve Stripe Payment Intent id and remaining refundable amount.
 * Prefers stored PI; falls back to Checkout Session retrieve.
 * Amount comes from Stripe remaining (or the write-once paid snapshot), never the quote.
 *
 * @param {object} reservation
 * @returns {Promise<{ paymentIntentId: string, amountCents: number|null, currency: string|null, source: string, paidAmountCents?: number|null }>}
 */
async function resolvePaymentIntentForReservation(reservation) {
  // Create the existing constant.
  const existing = reservation?.stripePaymentIntentId;
  // Initialize the mutable payment intent id variable.
  let paymentIntentId = existing ? String(existing) : null;
  // Initialize the mutable session fallback variable.
  let sessionFallback = null;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!paymentIntentId) {
    // Store the awaited result in sessionFallback.
    sessionFallback = await resolvePaymentIntentIdFromCheckoutSession(reservation);
    // Update paymentIntentId with the right-hand side value.
    paymentIntentId = sessionFallback.paymentIntentId;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (paymentIntentId) {
    // Protected block: isolate failure modes.
    try {
      // Create the from pi constant.
      const fromPi = await resolveFromPaymentIntent(paymentIntentId);
      // Evaluate the condition and enter the branch when it is true.
      if (fromPi.amountCents === 0) {
        // Return the resulting value to the caller.
        return fromPi;
      }
      // Evaluate the condition and enter the branch when it is true.
      if (fromPi.amountCents > 0) {
        // Return the resulting value to the caller.
        return fromPi;
      }
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call logger.warn to perform this step.
      logger.warn(
        {
          // Contribute this line to the enclosing declaration or statement.
          err,
          // Provide the reservation id field value.
          reservationId: reservation?.id,
          // Contribute this line to the enclosing declaration or statement.
          paymentIntentId,
        },
        // Supply the literal value used by the enclosing expression.
        'Failed to retrieve Stripe PaymentIntent remaining refundable amount'
      );
    }
  }

  // Fall back to write-once paid snapshot when Stripe remaining is unavailable.
  const snapshot = snapshotAmountCents(reservation);
  // Evaluate the condition and enter the branch when it is true.
  if (snapshot) {
    // Return the resulting value to the caller.
    return {
      // Contribute this line to the enclosing declaration or statement.
      paymentIntentId,
      // Provide the amount cents field value.
      amountCents: snapshot,
      // Provide the currency field value.
      currency: reservation.paidCurrency || sessionFallback?.currency || 'eur',
      // Provide the source field value.
      source: 'snapshot',
      // Provide the paid amount cents field value.
      paidAmountCents: snapshot,
    };
  }

  // Evaluate the condition and enter the branch when it is true.
  if (sessionFallback?.amountCents > 0) {
    // Return the resulting value to the caller.
    return {
      // Spread sessionFallback into the surrounding structure.
      ...sessionFallback,
      // Provide the paid amount cents field value.
      paidAmountCents: sessionFallback.amountCents,
    };
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (!paymentIntentId) {
    // Throw an error to stop the current control flow.
    throw refundError(
      // Supply the literal value used by the enclosing expression.
      'REFUND_NO_PAYMENT_INTENT',
      // Supply the literal value used by the enclosing expression.
      'Cannot refund: reservation has no Stripe Payment Intent or Checkout Session.'
    );
  }

  // Throw an error to stop the current control flow.
  throw refundError('REFUND_NO_AMOUNT', 'Cannot refund: missing refundable amount.');
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  resolvePaymentIntentForReservation,
  // Contribute this line to the enclosing declaration or statement.
  remainingRefundableCents,
  // Contribute this line to the enclosing declaration or statement.
  originalPaidCents,
  // Contribute this line to the enclosing declaration or statement.
  refundError,
};
