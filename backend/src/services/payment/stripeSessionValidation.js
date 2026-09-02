const { ACTIVE_RESERVATION_STATUSES } = require('../../utils/reservationHelpers');

const CHECKOUT_LINKABLE_STATUSES = ACTIVE_RESERVATION_STATUSES;
const EXPECTED_STRIPE_CURRENCY = 'eur';

function canLinkNewStripeSession(reservation) {
  return CHECKOUT_LINKABLE_STATUSES.includes(reservation?.status);
}

function validateActiveStripeSessionLink(reservation, incomingSessionId) {
  const activeSessionId = reservation?.stripeSessionId || null;

  if (!activeSessionId) {
    return { ok: true, orphanRecovery: true };
  }

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

function getExpectedStripeAmountCents(reservation) {
  return Math.round(Number(reservation.totalPrice) * 100);
}

function validateStripePaymentDetails(stripeSession, reservation) {
  const expectedAmount = getExpectedStripeAmountCents(reservation);

  if (stripeSession.amount_total !== expectedAmount) {
    return {
      ok: false,
      reason: 'stripe_amount_mismatch',
      expectedAmount,
      actualAmount: stripeSession.amount_total,
    };
  }

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

function paidSnapshotFromStripeSession(stripeSession) {
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

function paidSnapshotFromFinalizationContext(options = {}, stripeSession = null) {
  if (stripeSession && stripeSession.amount_total != null) {
    return paidSnapshotFromStripeSession(stripeSession);
  }

  if (options.stripeSessionAmountTotal != null) {
    return paidSnapshotFromStripeSession({
      amount_total: options.stripeSessionAmountTotal,
      currency: options.stripeSessionCurrency,
    });
  }

  return { paidAmountCents: null, paidCurrency: null };
}

function paidAmountPatch(paidAmountCents, paidCurrency) {
  if (!(Number(paidAmountCents) > 0)) {
    return {};
  }

  return {
    paidAmountCents: Math.round(Number(paidAmountCents)),
    paidCurrency: paidCurrency ? String(paidCurrency).toLowerCase() : 'eur',
  };
}

function buildStripeSessionSnapshot(session) {
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
