/**
 * Validation helpers for linking Stripe Checkout sessions to reservations
 * and verifying paid amount/currency before finalization.
 * Prevents stale sessions and amount mismatches from confirming the wrong booking.
 */
const { ACTIVE_RESERVATION_STATUSES } = require('../../utils/reservationHelpers');

/** Reservation statuses that may accept a new Checkout session link. */
const CHECKOUT_LINKABLE_STATUSES = ACTIVE_RESERVATION_STATUSES;
const EXPECTED_STRIPE_CURRENCY = 'eur';

/**
 * Whether a reservation may be linked to a newly created Stripe session.
 * @param {object} reservation
 * @returns {boolean}
 */
function canLinkNewStripeSession(reservation) {
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
  const activeSessionId = reservation?.stripeSessionId || null;

  // Guard: early-return or throw when required input is missing/invalid.
  if (!activeSessionId) {
    return { ok: true, orphanRecovery: true };
  }

  // Reject events for an older/superseded Checkout session still in flight.
  if (String(activeSessionId) !== String(incomingSessionId)) {
    return {
      ok: false,
      reason: 'stale_stripe_session',
      activeSessionId: String(activeSessionId),
      incomingSessionId: String(incomingSessionId),
    };
  }

  return { ok: true, orphanRecovery: false };
}

/**
 * Expected charge in cents from the reservation's quoted total.
 * @param {object} reservation
 * @returns {number}
 */
function getExpectedStripeAmountCents(reservation) {
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
  const expectedAmount = getExpectedStripeAmountCents(reservation);

  // Stripe / payment-related branch.
  if (stripeSession.amount_total !== expectedAmount) {
    return {
      ok: false,
      reason: 'stripe_amount_mismatch',
      expectedAmount,
      actualAmount: stripeSession.amount_total,
    };
  }

  // Stripe / payment-related branch.
  if (stripeSession.currency !== EXPECTED_STRIPE_CURRENCY) {
    return {
      ok: false,
      reason: 'stripe_currency_mismatch',
      expectedCurrency: EXPECTED_STRIPE_CURRENCY,
      actualCurrency: stripeSession.currency,
    };
  }

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
    return { paidAmountCents: null, paidCurrency: null };
  }

  const cents = Number(stripeSession.amount_total);
  const currency = stripeSession.currency
    ? String(stripeSession.currency).toLowerCase()
    : null;

  return {
    paidAmountCents: Number.isFinite(cents) && cents > 0 ? Math.round(cents) : null,
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
    return paidSnapshotFromStripeSession(stripeSession);
  }

  // Stripe / payment-related branch.
  if (options.stripeSessionAmountTotal != null) {
    return paidSnapshotFromStripeSession({
      amount_total: options.stripeSessionAmountTotal,
      currency: options.stripeSessionCurrency,
    });
  }

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
    return {};
  }

  return {
    paidAmountCents: Math.round(Number(paidAmountCents)),
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
    return null;
  }

  return {
    id: session.id,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    currency: session.currency,
  };
}

module.exports = {
  CHECKOUT_LINKABLE_STATUSES,
  EXPECTED_STRIPE_CURRENCY,
  canLinkNewStripeSession,
  validateActiveStripeSessionLink,
  getExpectedStripeAmountCents,
  validateStripePaymentDetails,
  paidSnapshotFromStripeSession,
  paidSnapshotFromFinalizationContext,
  paidAmountPatch,
  buildStripeSessionSnapshot,
};
