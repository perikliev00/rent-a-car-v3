/**
 * In-memory Stripe Checkout session stub for STRIPE_STUB=1 (E2E / local test servers).
 * Not used in production unless STRIPE_STUB is explicitly set.
 */

const sessions = new Map();
const refunds = new Map();
const refundsByIdempotency = new Map();
let counter = 0;
let refundCounter = 0;
let failNextCreate = false;
let failNextRefund = false;
let throwNextRefundAfterRecording = false;
let nextRefundStatus = null;
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

function failNextCreateRefund() {
  failNextRefund = true;
}

function throwNextCreateRefundAfterRecording() {
  throwNextRefundAfterRecording = true;
}

function setNextRefundStatus(status) {
  nextRefundStatus = status || null;
}

function createRefund({ paymentIntentId, amountCents = null, idempotencyKey }) {
  if (idempotencyKey && refundsByIdempotency.has(idempotencyKey)) {
    return { ...refundsByIdempotency.get(idempotencyKey) };
  }

  if (failNextRefund) {
    failNextRefund = false;
    const err = new Error('Stripe stub forced refund failure');
    err.type = 'StripeAPIError';
    err.code = 'refund_failed';
    throw err;
  }

  refundCounter += 1;
  const status = nextRefundStatus || 'succeeded';
  nextRefundStatus = null;

  let amount = amountCents;
  if (amount == null) {
    for (const session of sessions.values()) {
      if (String(session.payment_intent) === String(paymentIntentId)) {
        amount = session.amount_total;
        break;
      }
    }
  }
  if (amount == null) {
    amount = 10000;
  }

  const refund = {
    id: `re_test_${refundCounter}${Date.now()}`,
    object: 'refund',
    amount: Number(amount),
    currency: 'eur',
    payment_intent: String(paymentIntentId),
    status,
  };

  refunds.set(refund.id, refund);
  if (idempotencyKey) {
    refundsByIdempotency.set(idempotencyKey, refund);
  }

  if (throwNextRefundAfterRecording) {
    throwNextRefundAfterRecording = false;
    const err = new Error('Stripe stub timeout after recording refund');
    err.type = 'StripeConnectionError';
    err.code = 'ETIMEDOUT';
    throw err;
  }

  return { ...refund };
}

function retrieveRefund(refundId) {
  const refund = refunds.get(refundId);
  if (!refund) {
    const err = new Error(`No such refund: ${refundId}`);
    err.type = 'StripeInvalidRequestError';
    throw err;
  }
  return { ...refund };
}

function setRefundState(refundId, patch = {}) {
  const refund = refunds.get(refundId);
  if (!refund) {
    const err = new Error(`No such refund: ${refundId}`);
    err.type = 'StripeInvalidRequestError';
    throw err;
  }
  Object.assign(refund, patch);
  return { ...refund };
}

function clearSessions() {
  sessions.clear();
  refunds.clear();
  refundsByIdempotency.clear();
  counter = 0;
  refundCounter = 0;
  failNextCreate = false;
  failNextRefund = false;
  throwNextRefundAfterRecording = false;
  nextRefundStatus = null;
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
  createRefund,
  retrieveRefund,
  setRefundState,
  failNextCreateRefund,
  throwNextCreateRefundAfterRecording,
  setNextRefundStatus,
  clearSessions,
  isStubEnabled,
  sessions,
  refunds,
};
