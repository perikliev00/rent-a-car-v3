/**
 * Validation helpers for linking Stripe Checkout sessions to reservations
 * and verifying paid amount/currency before finalization.
 * Prevents stale sessions and amount mismatches from confirming the wrong booking.
 */
const { ACTIVE_RESERVATION_STATUSES } = require('../../utils/reservationHelpers');

/** Reservation statuses that may accept a new Checkout session link. */
const CHECKOUT_LINKABLE_STATUSES = ACTIVE_RESERVATION_STATUSES;
// Create the expected stripe currency constant.
const EXPECTED_STRIPE_CURRENCY = 'eur';

/**
 * Whether a reservation may be linked to a newly created Stripe session.
 * @param {object} reservation
 * @returns {boolean}
 */
function canLinkNewStripeSession(reservation) {
  // Return the resulting value to the caller.
  return CHECKOUT_LINKABLE_STATUSES.includes(reservation?.status);
}

/**
 * Ensure the incoming webhook/success session matches the reservation's active session.
 * orphanRecovery=true when no session is stored yet (e.g. race before link persisted).
 *
 * @param {object} reservation
 * @param {string} incomingSessionId
 * @returns {{ ok: boolean, orphanRecovery?: boolean, reason?: string, activeSessionId?: string, incomingSessionId?: string }}
 */
function validateActiveStripeSessionLink(reservation, incomingSessionId) {
  // Create the active session id constant.
  const activeSessionId = reservation?.stripeSessionId || null;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!activeSessionId) {
    // Return the resulting value to the caller.
    return { ok: true, orphanRecovery: true };
  }

  // Reject events for an older/superseded Checkout session still in flight.
  if (String(activeSessionId) !== String(incomingSessionId)) {
    // Return the resulting value to the caller.
    return {
      // Provide the ok field value.
      ok: false,
      // Provide the reason field value.
      reason: 'stale_stripe_session',
      // Provide the active session id field value.
      activeSessionId: String(activeSessionId),
      // Provide the incoming session id field value.
      incomingSessionId: String(incomingSessionId),
    };
  }

  // Return the resulting value to the caller.
  return { ok: true, orphanRecovery: false };
}

/**
 * Expected charge in cents from the reservation's quoted total.
 * @param {object} reservation
 * @returns {number}
 */
function getExpectedStripeAmountCents(reservation) {
  // Return the resulting value to the caller.
  return Math.round(Number(reservation.totalPrice) * 100);
}

/**
 * Compare Stripe session amount/currency to the reservation quote.
 * Mismatch blocks automatic finalization (possible tampering or stale quote).
 *
 * @param {object} stripeSession
 * @param {object} reservation
 * @returns {{ ok: boolean, reason?: string, expectedAmount?: number, actualAmount?: *, expectedCurrency?: string, actualCurrency?: * }}
 */
function validateStripePaymentDetails(stripeSession, reservation) {
  // Create the expected amount constant.
  const expectedAmount = getExpectedStripeAmountCents(reservation);

  // Stripe / payment-related branch.
  if (stripeSession.amount_total !== expectedAmount) {
    // Return the resulting value to the caller.
    return {
      // Provide the ok field value.
      ok: false,
      // Provide the reason field value.
      reason: 'stripe_amount_mismatch',
      // Contribute this line to the enclosing declaration or statement.
      expectedAmount,
      // Provide the actual amount field value.
      actualAmount: stripeSession.amount_total,
    };
  }

  // Stripe / payment-related branch.
  if (stripeSession.currency !== EXPECTED_STRIPE_CURRENCY) {
    // Return the resulting value to the caller.
    return {
      // Provide the ok field value.
      ok: false,
      // Provide the reason field value.
      reason: 'stripe_currency_mismatch',
      // Provide the expected currency field value.
      expectedCurrency: EXPECTED_STRIPE_CURRENCY,
      // Provide the actual currency field value.
      actualCurrency: stripeSession.currency,
    };
  }

  // Return the resulting value to the caller.
  return { ok: true };
}

/**
 * Extract paid amount/currency snapshot from a Stripe session for persistence.
 * @param {object|null|undefined} stripeSession
 * @returns {{ paidAmountCents: number|null, paidCurrency: string|null }}
 */
function paidSnapshotFromStripeSession(stripeSession) {
  // Stripe / payment-related branch.
  if (!stripeSession) {
    // Return the resulting value to the caller.
    return { paidAmountCents: null, paidCurrency: null };
  }

  // Create the cents constant.
  const cents = Number(stripeSession.amount_total);
  // Create the currency constant.
  const currency = stripeSession.currency
    // Continue the surrounding logic with this statement.
    ? String(stripeSession.currency).toLowerCase()
    // Contribute this line to the enclosing declaration or statement.
    : null;

  // Return the resulting value to the caller.
  return {
    // Provide the paid amount cents field value.
    paidAmountCents: Number.isFinite(cents) && cents > 0 ? Math.round(cents) : null,
    // Provide the paid currency field value.
    paidCurrency: currency || null,
  };
}

/**
 * Prefer live Stripe session fields; fall back to amounts passed on the finalization context.
 * @param {object} [options]
 * @param {object|null} [stripeSession]
 * @returns {{ paidAmountCents: number|null, paidCurrency: string|null }}
 */
function paidSnapshotFromFinalizationContext(options = {}, stripeSession = null) {
  // Stripe / payment-related branch.
  if (stripeSession && stripeSession.amount_total != null) {
    // Return the resulting value to the caller.
    return paidSnapshotFromStripeSession(stripeSession);
  }

  // Stripe / payment-related branch.
  if (options.stripeSessionAmountTotal != null) {
    // Return the resulting value to the caller.
    return paidSnapshotFromStripeSession({
      // Provide the amount total field value.
      amount_total: options.stripeSessionAmountTotal,
      // Provide the currency field value.
      currency: options.stripeSessionCurrency,
    });
  }

  // Return the resulting value to the caller.
  return { paidAmountCents: null, paidCurrency: null };
}

/**
 * Build a patch object for storing paid amount on a reservation (empty if no valid cents).
 * @param {number|null|undefined} paidAmountCents
 * @param {string|null|undefined} paidCurrency
 * @returns {object}
 */
function paidAmountPatch(paidAmountCents, paidCurrency) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!(Number(paidAmountCents) > 0)) {
    // Return the resulting value to the caller.
    return {};
  }

  // Return the resulting value to the caller.
  return {
    // Provide the paid amount cents field value.
    paidAmountCents: Math.round(Number(paidAmountCents)),
    // Provide the paid currency field value.
    paidCurrency: paidCurrency ? String(paidCurrency).toLowerCase() : 'eur',
  };
}

/**
 * Minimal session fields for logs / audit without storing the full Stripe object.
 * @param {object|null|undefined} session
 * @returns {object|null}
 */
function buildStripeSessionSnapshot(session) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!session) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: session.id,
    // Provide the payment status field value.
    payment_status: session.payment_status,
    // Provide the amount total field value.
    amount_total: session.amount_total,
    // Provide the currency field value.
    currency: session.currency,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  CHECKOUT_LINKABLE_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  EXPECTED_STRIPE_CURRENCY,
  // Contribute this line to the enclosing declaration or statement.
  canLinkNewStripeSession,
  // Contribute this line to the enclosing declaration or statement.
  validateActiveStripeSessionLink,
  // Contribute this line to the enclosing declaration or statement.
  getExpectedStripeAmountCents,
  // Contribute this line to the enclosing declaration or statement.
  validateStripePaymentDetails,
  // Contribute this line to the enclosing declaration or statement.
  paidSnapshotFromStripeSession,
  // Contribute this line to the enclosing declaration or statement.
  paidSnapshotFromFinalizationContext,
  // Contribute this line to the enclosing declaration or statement.
  paidAmountPatch,
  // Contribute this line to the enclosing declaration or statement.
  buildStripeSessionSnapshot,
};
