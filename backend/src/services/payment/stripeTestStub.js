/**
 * In-memory Stripe Checkout / refund / PaymentIntent stub for STRIPE_STUB=1
 * (E2E and local test servers). Mirrors idempotency and failure hooks so
 * payment flows can be exercised without calling Stripe.
 * Production startup rejects STRIPE_STUB via validateEnv().
 */

const sessions = new Map();
/** Idempotency key → session; same key returns the same session (Stripe-like). */
const sessionsByIdempotency = new Map();
const refunds = new Map();
const refundsByIdempotency = new Map();
const paymentIntents = new Map();
let counter = 0;
let refundCounter = 0;
let failNextCreate = false;
let failNextRefund = false;
/** Simulates timeout after Stripe has already recorded the refund (reconcile paths). */
let throwNextRefundAfterRecording = false;
let nextRefundStatus = null;
let createOverrides = null;
/** Optional barrier to park createSession mid-flight for concurrency E2E tests. */
let createGate = null;
let createGateConsumed = false;

/**
 * Insert deferred and return the mapped result.
 * @returns {*}
 */
function createDeferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Release any armed create-session gate so waiters are not left hanging. */
function clearCreateSessionGate() {
  if (createGate) {
    createGate.continue.resolve();
    createGate = null;
  }
  createGateConsumed = false;
}

/**
 * Arm a two-phase gate: createSession pauses after signaling "started"
 * until releaseCreateSessionGate() continues it.
 */
function armCreateSessionGate() {
  clearCreateSessionGate();
  createGate = {
    started: createDeferred(),
    continue: createDeferred(),
  };
  createGateConsumed = false;
}

/**
 * Wait until a gated createSession call has started (for race tests).
 * @param {{ timeoutMs?: number }} [options]
 */
async function waitForCreateSession({ timeoutMs = 8000 } = {}) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!createGate) {
    throw new Error('Create session gate is not armed');
  }

  let timeoutId;
  // Protected block: isolate failure modes.
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

/** Allow a paused createSession to finish. */
function releaseCreateSessionGate() {
  if (createGate) {
    createGate.continue.resolve();
  }
}

/**
 * Transform helper: build success url.
 * @param {string|number} sessionId
 * @returns {*}
 */
function buildSuccessUrl(sessionId) {
  const base = (process.env.FRONTEND_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/checkout/success?session_id=${sessionId}`;
}

/**
 * Create a stub Checkout session (honors idempotency, fail-next, and create gate).
 * @param {object} [params]
 * @returns {Promise<object>}
 */
async function createSession({ reservationId, carId, sessionId, pricing, car, idempotencyKey } = {}) {
  // Mirror Stripe: same idempotency key returns the prior session.
  if (idempotencyKey && sessionsByIdempotency.has(idempotencyKey)) {
    return { ...sessionsByIdempotency.get(idempotencyKey) };
  }

  // Guard: early-return or throw when required input is missing/invalid.
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

  // Orphan sessions have no reservation metadata (paid-but-unlinked recovery tests).
  if (overrides.orphan) {
    delete session.metadata.reservationId;
    delete session.metadata.carId;
    delete session.metadata.sessionId;
  }

  sessions.set(id, session);
  ensurePaymentIntentFromSession(session);
  // Idempotency guard: return early when work was already applied.
  if (idempotencyKey) {
    sessionsByIdempotency.set(idempotencyKey, session);
  }
  return { ...session };
}

/**
 * retrieve session.
 * @param {string|number} sessionId
 * @returns {*}
 */
function retrieveSession(sessionId) {
  const session = sessions.get(sessionId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!session) {
    const err = new Error(`No such checkout.session: ${sessionId}`);
    err.type = 'StripeInvalidRequestError';
    throw err;
  }

  // Return stored state (do not force paid) so cleanup/reconcile tests can distinguish open/paid/expired.
  return { ...session };
}

/**
 * set session state — mutates persisted state when applicable.
 * @param {string|number} sessionId
 * @param {object} [patch]
 * @returns {*}
 */
function setSessionState(sessionId, patch = {}) {
  const session = sessions.get(sessionId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!session) {
    const err = new Error(`No such checkout.session: ${sessionId}`);
    err.type = 'StripeInvalidRequestError';
    throw err;
  }
  Object.assign(session, patch);
  return { ...session };
}

/**
 * mark paid — mutates persisted state when applicable.
 * @param {string|number} sessionId
 * @param {object} [patch]
 * @returns {*}
 */
function markPaid(sessionId, patch = {}) {
  return setSessionState(sessionId, {
    payment_status: 'paid',
    status: 'complete',
    ...patch,
  });
}

/**
 * mark unpaid open — mutates persisted state when applicable.
 * @param {string|number} sessionId
 * @returns {*}
 */
function markUnpaidOpen(sessionId) {
  return setSessionState(sessionId, {
    payment_status: 'unpaid',
    status: 'open',
  });
}

/**
 * expire session.
 * @param {string|number} sessionId
 * @returns {*}
 */
function expireSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = 'expired';
    // Status / lifecycle guard before mutating domain state.
    if (session.payment_status !== 'paid') {
      session.payment_status = 'unpaid';
    }
  }
  return session ? { ...session } : null;
}

/**
 * fail next create session.
 * @returns {*}
 */
function failNextCreateSession() {
  failNextCreate = true;
}

/**
 * set next create overrides — mutates persisted state when applicable.
 * @param {*} overrides
 * @returns {*}
 */
function setNextCreateOverrides(overrides) {
  createOverrides = overrides ? { ...overrides } : null;
}

/**
 * Insert orphan paid session and return the mapped result.
 * @param {object} params
 * @returns {*}
 */
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

/**
 * Ensure payment intent from session exists or is initialized.
 * @param {object} session
 * @returns {*}
 */
function ensurePaymentIntentFromSession(session) {
  const piId = String(session.payment_intent);
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * remaining of.
 * @param {*} pi
 * @returns {*}
 */
function remainingOf(pi) {
  return Math.max(0, Number(pi.amount_received || 0) - Number(pi.amount_refunded || 0));
}

/**
 * Load or create payment intent.
 * @param {string|number} paymentIntentId
 * @param {number} [fallbackAmount]
 * @returns {*}
 */
function getOrCreatePaymentIntent(paymentIntentId, fallbackAmount = null) {
  const id = String(paymentIntentId);
  if (paymentIntents.has(id)) {
    return paymentIntents.get(id);
  }

  for (const session of sessions.values()) {
    // Stripe / payment-related branch.
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

/**
 * retrieve payment intent.
 * @param {string|number} paymentIntentId
 * @param {*} [{ expand }]
 * @returns {*}
 */
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

/**
 * fail next create refund.
 * @returns {*}
 */
function failNextCreateRefund() {
  failNextRefund = true;
}

/**
 * throw next create refund after recording.
 * @returns {*}
 */
function throwNextCreateRefundAfterRecording() {
  throwNextRefundAfterRecording = true;
}

/**
 * set next refund status — mutates persisted state when applicable.
 * @param {string} status
 * @returns {*}
 */
function setNextRefundStatus(status) {
  nextRefundStatus = status || null;
}

/**
 * Create a stub refund; enforces remaining balance and optional fail/throw hooks.
 * @param {{ paymentIntentId: string, amountCents?: number|null, idempotencyKey?: string }} params
 * @returns {object}
 */
function createRefund({ paymentIntentId, amountCents = null, idempotencyKey }) {
  // Idempotency guard: return early when work was already applied.
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
  // Guard: early-return or throw when required input is missing/invalid.
  if (amount == null) {
    amount = remainingOf(pi);
  }
  // Guard: early-return or throw when required input is missing/invalid.
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
  // Idempotency guard: return early when work was already applied.
  if (idempotencyKey) {
    refundsByIdempotency.set(idempotencyKey, refund);
  }
  pi.amount_refunded = Number(pi.amount_refunded || 0) + Number(amount);

  // Refund exists at Stripe but the HTTP response failed — callers must reconcile.
  if (throwNextRefundAfterRecording) {
    throwNextRefundAfterRecording = false;
    const err = new Error('Stripe stub timeout after recording refund');
    err.type = 'StripeConnectionError';
    err.code = 'ETIMEDOUT';
    throw err;
  }

  return { ...refund };
}

/**
 * retrieve refund.
 * @param {string|number} refundId
 * @returns {*}
 */
function retrieveRefund(refundId) {
  const refund = refunds.get(refundId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!refund) {
    const err = new Error(`No such refund: ${refundId}`);
    err.type = 'StripeInvalidRequestError';
    throw err;
  }
  return { ...refund };
}

/**
 * set refund state — mutates persisted state when applicable.
 * @param {string|number} refundId
 * @param {object} [patch]
 * @returns {*}
 */
function setRefundState(refundId, patch = {}) {
  const refund = refunds.get(refundId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!refund) {
    const err = new Error(`No such refund: ${refundId}`);
    err.type = 'StripeInvalidRequestError';
    throw err;
  }
  Object.assign(refund, patch);
  return { ...refund };
}

/** Reset all stub state between tests. */
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

/**
 * Whether STRIPE_STUB env enables this in-memory driver.
 * @returns {boolean}
 */
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
