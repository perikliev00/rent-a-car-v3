/**
 * In-memory Stripe Checkout session stub for STRIPE_STUB=1 (E2E / local test servers).
 * Production startup rejects STRIPE_STUB via validateEnv().
 */

const sessions = new Map();
const sessionsByIdempotency = new Map();
const refunds = new Map();
const refundsByIdempotency = new Map();
const paymentIntents = new Map();
let counter = 0;
let refundCounter = 0;
let failNextCreate = false;
let failNextRefund = false;
let throwNextRefundAfterRecording = false;
let nextRefundStatus = null;
let createOverrides = null;
let createGate = null;
let createGateConsumed = false;

function createDeferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function clearCreateSessionGate() {
  if (createGate) {
    createGate.continue.resolve();
    createGate = null;
  }
  createGateConsumed = false;
}

function armCreateSessionGate() {
  clearCreateSessionGate();
  createGate = {
    started: createDeferred(),
    continue: createDeferred(),
  };
  createGateConsumed = false;
}

async function waitForCreateSession({ timeoutMs = 8000 } = {}) {
  if (!createGate) {
    throw new Error('Create session gate is not armed');
  }

  let timeoutId;
  try {
    await Promise.race([
      createGate.started.promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Timed out waiting for Stripe createSession')),
          timeoutMs
        );
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function releaseCreateSessionGate() {
  if (createGate) {
    createGate.continue.resolve();
  }
}

function buildSuccessUrl(sessionId) {
  const base = (process.env.FRONTEND_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/checkout/success?session_id=${sessionId}`;
}

async function createSession({ reservationId, carId, sessionId, pricing, car, idempotencyKey } = {}) {
  if (idempotencyKey && sessionsByIdempotency.has(idempotencyKey)) {
    return { ...sessionsByIdempotency.get(idempotencyKey) };
  }

  if (createGate && !createGateConsumed) {
    createGateConsumed = true;
    createGate.started.resolve();
    await createGate.continue.promise;
  }

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
  ensurePaymentIntentFromSession(session);
  if (idempotencyKey) {
    sessionsByIdempotency.set(idempotencyKey, session);
  }
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

function ensurePaymentIntentFromSession(session) {
  const piId = String(session.payment_intent);
  if (!paymentIntents.has(piId)) {
    paymentIntents.set(piId, {
      id: piId,
      amount_received: Number(session.amount_total) || 0,
      amount_refunded: 0,
      currency: session.currency || 'eur',
    });
  }
  return paymentIntents.get(piId);
}

function remainingOf(pi) {
  return Math.max(0, Number(pi.amount_received || 0) - Number(pi.amount_refunded || 0));
}

function getOrCreatePaymentIntent(paymentIntentId, fallbackAmount = null) {
  const id = String(paymentIntentId);
  if (paymentIntents.has(id)) {
    return paymentIntents.get(id);
  }

  for (const session of sessions.values()) {
    if (String(session.payment_intent) === id) {
      return ensurePaymentIntentFromSession(session);
    }
  }

  const amount = fallbackAmount != null ? Number(fallbackAmount) : 10000;
  const pi = {
    id,
    amount_received: Number.isFinite(amount) && amount > 0 ? amount : 10000,
    amount_refunded: 0,
    currency: 'eur',
  };
  paymentIntents.set(id, pi);
  return pi;
}

function retrievePaymentIntent(paymentIntentId, { expand } = {}) {
  const pi = getOrCreatePaymentIntent(paymentIntentId);
  const captured = Number(pi.amount_received) || 0;
  const result = {
    id: pi.id,
    object: 'payment_intent',
    amount: captured,
    amount_received: captured,
    currency: pi.currency || 'eur',
    latest_charge: `ch_test_${pi.id}`,
  };

  if (expand && expand.includes('latest_charge')) {
    result.latest_charge = {
      id: `ch_test_${pi.id}`,
      object: 'charge',
      amount: captured,
      amount_captured: captured,
      amount_refunded: Number(pi.amount_refunded) || 0,
      currency: pi.currency || 'eur',
    };
  }

  return result;
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

  const pi = getOrCreatePaymentIntent(paymentIntentId, amountCents);
  let amount = amountCents;
  if (amount == null) {
    amount = remainingOf(pi);
  }
  if (amount == null) {
    amount = 10000;
  }

  const remaining = remainingOf(pi);
  if (Number(amount) > remaining) {
    const err = new Error(
      `The refund amount (${amount}) exceeds the remaining refundable amount (${remaining})`
    );
    err.type = 'StripeInvalidRequestError';
    throw err;
  }

  const refund = {
    id: `re_test_${refundCounter}${Date.now()}`,
    object: 'refund',
    amount: Number(amount),
    currency: pi.currency || 'eur',
    payment_intent: String(paymentIntentId),
    status,
  };

  refunds.set(refund.id, refund);
  if (idempotencyKey) {
    refundsByIdempotency.set(idempotencyKey, refund);
  }
  pi.amount_refunded = Number(pi.amount_refunded || 0) + Number(amount);

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
  sessionsByIdempotency.clear();
  refunds.clear();
  refundsByIdempotency.clear();
  paymentIntents.clear();
  counter = 0;
  refundCounter = 0;
  failNextCreate = false;
  failNextRefund = false;
  throwNextRefundAfterRecording = false;
  nextRefundStatus = null;
  createOverrides = null;
  clearCreateSessionGate();
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
  armCreateSessionGate,
  waitForCreateSession,
  releaseCreateSessionGate,
  setNextCreateOverrides,
  createOrphanPaidSession,
  createRefund,
  retrieveRefund,
  retrievePaymentIntent,
  setRefundState,
  failNextCreateRefund,
  throwNextCreateRefundAfterRecording,
  setNextRefundStatus,
  clearSessions,
  isStubEnabled,
  sessions,
  refunds,
};
