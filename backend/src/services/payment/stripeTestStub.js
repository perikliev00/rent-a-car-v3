/**
 * In-memory Stripe Checkout session stub for STRIPE_STUB=1 (E2E / local test servers).
 * Not used in production unless STRIPE_STUB is explicitly set.
 */

const sessions = new Map();
let counter = 0;
let failNextCreate = false;
let createOverrides = null;

function buildSuccessUrl(sessionId) {
  const base = (process.env.FRONTEND_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/checkout/success?session_id=${sessionId}`;
}

function createSession({ reservationId, carId, sessionId, pricing, car } = {}) {
  if (failNextCreate) {
    failNextCreate = false;
    const err = new Error('Stripe stub forced create failure');
    err.type = 'StripeAPIError';
    throw err;
  }

  counter += 1;
  const overrides = createOverrides || {};
  createOverrides = null;

  const id =
    overrides.id ||
    (overrides.orphan
      ? `cs_test_orphan_${counter}${Date.now()}`
      : `cs_test_e2e${counter}${Date.now()}`);

  const amountTotal =
    overrides.amountTotal != null
      ? Number(overrides.amountTotal)
      : Math.round(Number(pricing?.totalPrice || 0) * 100);

  const session = {
    id,
    url: buildSuccessUrl(id),
    payment_status: overrides.paymentStatus || 'unpaid',
    status: overrides.status || 'open',
    amount_total: amountTotal,
    currency: overrides.currency || 'eur',
    client_reference_id:
      overrides.clientReferenceId != null
        ? String(overrides.clientReferenceId)
        : reservationId != null
          ? String(reservationId)
          : null,
    metadata: {
      ...(overrides.orphan
        ? {}
        : {
            reservationId: reservationId != null ? String(reservationId) : '',
            carId: carId != null ? String(carId) : '',
            sessionId: sessionId != null ? String(sessionId) : '',
          }),
      ...(overrides.metadata || {}),
    },
    payment_intent: overrides.paymentIntent || `pi_test_${counter}`,
  };

  if (overrides.orphan) {
    delete session.metadata.reservationId;
    delete session.metadata.carId;
    delete session.metadata.sessionId;
  }

  sessions.set(id, session);
  return { ...session };
}

function retrieveSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    const err = new Error(`No such checkout.session: ${sessionId}`);
    err.type = 'StripeInvalidRequestError';
    throw err;
  }

  // Return stored state (do not force paid) so cleanup/reconcile tests can distinguish open/paid/expired.
  return { ...session };
}

function setSessionState(sessionId, patch = {}) {
  const session = sessions.get(sessionId);
  if (!session) {
    const err = new Error(`No such checkout.session: ${sessionId}`);
    err.type = 'StripeInvalidRequestError';
    throw err;
  }
  Object.assign(session, patch);
  return { ...session };
}

function markPaid(sessionId, patch = {}) {
  return setSessionState(sessionId, {
    payment_status: 'paid',
    status: 'complete',
    ...patch,
  });
}

function markUnpaidOpen(sessionId) {
  return setSessionState(sessionId, {
    payment_status: 'unpaid',
    status: 'open',
  });
}

function expireSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = 'expired';
    if (session.payment_status !== 'paid') {
      session.payment_status = 'unpaid';
    }
  }
  return session ? { ...session } : null;
}

function failNextCreateSession() {
  failNextCreate = true;
}

function setNextCreateOverrides(overrides) {
  createOverrides = overrides ? { ...overrides } : null;
}

function createOrphanPaidSession({ amountTotal = 10000, currency = 'eur' } = {}) {
  setNextCreateOverrides({
    orphan: true,
    paymentStatus: 'paid',
    status: 'complete',
    amountTotal,
    currency,
    clientReferenceId: null,
  });
  return createSession({
    pricing: { totalPrice: amountTotal / 100 },
  });
}

function clearSessions() {
  sessions.clear();
  counter = 0;
  failNextCreate = false;
  createOverrides = null;
}

function isStubEnabled() {
  return ['1', 'true', 'yes'].includes(String(process.env.STRIPE_STUB || '').toLowerCase());
}

module.exports = {
  createSession,
  retrieveSession,
  setSessionState,
  markPaid,
  markUnpaidOpen,
  expireSession,
  failNextCreateSession,
  setNextCreateOverrides,
  createOrphanPaidSession,
  clearSessions,
  isStubEnabled,
  sessions,
};
