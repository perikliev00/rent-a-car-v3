/**
 * In-memory Stripe Checkout / refund / PaymentIntent stub for STRIPE_STUB=1
 * (E2E and local test servers). Mirrors idempotency and failure hooks so
 * payment flows can be exercised without calling Stripe.
 * Production startup rejects STRIPE_STUB via validateEnv().
 */

const sessions = new Map();
/** Idempotency key → session; same key returns the same session (Stripe-like). */
const sessionsByIdempotency = new Map();
// Create the refunds constant.
const refunds = new Map();
// Create the refunds by idempotency constant.
const refundsByIdempotency = new Map();
// Create the payment intents constant.
const paymentIntents = new Map();
// Initialize the mutable counter variable.
let counter = 0;
// Initialize the mutable refund counter variable.
let refundCounter = 0;
// Initialize the mutable fail next create variable.
let failNextCreate = false;
// Initialize the mutable fail next refund variable.
let failNextRefund = false;
/** Simulates timeout after Stripe has already recorded the refund (reconcile paths). */
let throwNextRefundAfterRecording = false;
// Initialize the mutable next refund status variable.
let nextRefundStatus = null;
// Initialize the mutable create overrides variable.
let createOverrides = null;
/** Optional barrier to park createSession mid-flight for concurrency E2E tests. */
let createGate = null;
// Initialize the mutable create gate consumed variable.
let createGateConsumed = false;

/**
 * Insert deferred and return the mapped result.
 * @returns {*}
 */
function createDeferred() {
  // Reserve the resolve variable for later assignment.
  let resolve;
  // Create the promise constant.
  const promise = new Promise((r) => {
    // Update resolve with the right-hand side value.
    resolve = r;
  });
  // Return the resulting value to the caller.
  return { promise, resolve };
}

/** Release any armed create-session gate so waiters are not left hanging. */
function clearCreateSessionGate() {
  // Evaluate the condition and enter the branch when it is true.
  if (createGate) {
    // Call createGate.continue.resolve to perform this step.
    createGate.continue.resolve();
    // Update createGate with the right-hand side value.
    createGate = null;
  }
  // Update createGateConsumed with the right-hand side value.
  createGateConsumed = false;
}

/**
 * Arm a two-phase gate: createSession pauses after signaling "started"
 * until releaseCreateSessionGate() continues it.
 */
function armCreateSessionGate() {
  // Call clearCreateSessionGate to perform this step.
  clearCreateSessionGate();
  // Update createGate with the right-hand side value.
  createGate = {
    // Provide the started field value.
    started: createDeferred(),
    // Continue with the next loop iteration.
    continue: createDeferred(),
  };
  // Update createGateConsumed with the right-hand side value.
  createGateConsumed = false;
}

/**
 * Wait until a gated createSession call has started (for race tests).
 * @param {{ timeoutMs?: number }} [options]
 */
async function waitForCreateSession({ timeoutMs = 8000 } = {}) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!createGate) {
    // Throw an error to stop the current control flow.
    throw new Error('Create session gate is not armed');
  }

  // Reserve the timeout id variable for later assignment.
  let timeoutId;
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await Promise.race([
      // Contribute this line to the enclosing declaration or statement.
      createGate.started.promise,
      // Continue the surrounding logic with this statement.
      new Promise((_, reject) => {
        // Update timeoutId with the right-hand side value.
        timeoutId = setTimeout(
          // Continue the surrounding logic with this statement.
          () => reject(new Error('Timed out waiting for Stripe createSession')),
          // Reference the identifier used by the enclosing expression.
          timeoutMs
        );
      }),
    ]);
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Call clearTimeout to perform this step.
    clearTimeout(timeoutId);
  }
}

/** Allow a paused createSession to finish. */
function releaseCreateSessionGate() {
  // Evaluate the condition and enter the branch when it is true.
  if (createGate) {
    // Call createGate.continue.resolve to perform this step.
    createGate.continue.resolve();
  }
}

/**
 * Transform helper: build success url.
 * @param {string|number} sessionId
 * @returns {*}
 */
function buildSuccessUrl(sessionId) {
  // Create the base constant.
  const base = (process.env.FRONTEND_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return { ...sessionsByIdempotency.get(idempotencyKey) };
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (createGate && !createGateConsumed) {
    // Update createGateConsumed with the right-hand side value.
    createGateConsumed = true;
    // Call createGate.started.resolve to perform this step.
    createGate.started.resolve();
    // Wait until the asynchronous operation resolves.
    await createGate.continue.promise;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (failNextCreate) {
    // Update failNextCreate with the right-hand side value.
    failNextCreate = false;
    // Create the err constant.
    const err = new Error('Stripe stub forced create failure');
    // Update err.type with the right-hand side value.
    err.type = 'StripeAPIError';
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Update counter with the right-hand side value.
  counter += 1;
  // Create the overrides constant.
  const overrides = createOverrides || {};
  // Update createOverrides with the right-hand side value.
  createOverrides = null;

  // Create the id constant.
  const id =
    // Contribute this line to the enclosing declaration or statement.
    overrides.id ||
    // Continue the surrounding logic with this statement.
    (overrides.orphan
      // Continue the surrounding logic with this statement.
      ? `cs_test_orphan_${counter}${Date.now()}`
      // Continue the surrounding logic with this statement.
      : `cs_test_e2e${counter}${Date.now()}`);

  // Create the amount total constant.
  const amountTotal =
    // Continue the surrounding logic with this statement.
    overrides.amountTotal != null
      // Continue the surrounding logic with this statement.
      ? Number(overrides.amountTotal)
      // Continue the surrounding logic with this statement.
      : Math.round(Number(pricing?.totalPrice || 0) * 100);

  // Create the session constant.
  const session = {
    // Contribute this line to the enclosing declaration or statement.
    id,
    // Provide the url field value.
    url: buildSuccessUrl(id),
    // Provide the payment status field value.
    payment_status: overrides.paymentStatus || 'unpaid',
    // Provide the status field value.
    status: overrides.status || 'open',
    // Provide the amount total field value.
    amount_total: amountTotal,
    // Provide the currency field value.
    currency: overrides.currency || 'eur',
    // Provide the client reference id field value.
    client_reference_id:
      // Continue the surrounding logic with this statement.
      overrides.clientReferenceId != null
        // Continue the surrounding logic with this statement.
        ? String(overrides.clientReferenceId)
        // Continue the surrounding logic with this statement.
        : reservationId != null
          // Continue the surrounding logic with this statement.
          ? String(reservationId)
          // Contribute this line to the enclosing declaration or statement.
          : null,
    // Provide the metadata field value.
    metadata: {
      // Call ... to perform this step.
      ...(overrides.orphan
        // Contribute this line to the enclosing declaration or statement.
        ? {}
        // Contribute this line to the enclosing declaration or statement.
        : {
            // Provide the reservation id field value.
            reservationId: reservationId != null ? String(reservationId) : '',
            // Provide the car id field value.
            carId: carId != null ? String(carId) : '',
            // Provide the session id field value.
            sessionId: sessionId != null ? String(sessionId) : '',
          }),
      // Call ... to perform this step.
      ...(overrides.metadata || {}),
    },
    // Provide the payment intent field value.
    payment_intent: overrides.paymentIntent || `pi_test_${counter}`,
  };

  // Orphan sessions have no reservation metadata (paid-but-unlinked recovery tests).
  if (overrides.orphan) {
    // Delete the specified property from the object.
    delete session.metadata.reservationId;
    // Delete the specified property from the object.
    delete session.metadata.carId;
    // Delete the specified property from the object.
    delete session.metadata.sessionId;
  }

  // Call sessions.set to perform this step.
  sessions.set(id, session);
  // Call ensurePaymentIntentFromSession to perform this step.
  ensurePaymentIntentFromSession(session);
  // Idempotency guard: return early when work was already applied.
  if (idempotencyKey) {
    // Call sessionsByIdempotency.set to perform this step.
    sessionsByIdempotency.set(idempotencyKey, session);
  }
  // Return the resulting value to the caller.
  return { ...session };
}

/**
 * retrieve session.
 * @param {string|number} sessionId
 * @returns {*}
 */
function retrieveSession(sessionId) {
  // Create the session constant.
  const session = sessions.get(sessionId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!session) {
    // Create the err constant.
    const err = new Error(`No such checkout.session: ${sessionId}`);
    // Update err.type with the right-hand side value.
    err.type = 'StripeInvalidRequestError';
    // Throw an error to stop the current control flow.
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
  // Create the session constant.
  const session = sessions.get(sessionId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!session) {
    // Create the err constant.
    const err = new Error(`No such checkout.session: ${sessionId}`);
    // Update err.type with the right-hand side value.
    err.type = 'StripeInvalidRequestError';
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Call Object.assign to perform this step.
  Object.assign(session, patch);
  // Return the resulting value to the caller.
  return { ...session };
}

/**
 * mark paid — mutates persisted state when applicable.
 * @param {string|number} sessionId
 * @param {object} [patch]
 * @returns {*}
 */
function markPaid(sessionId, patch = {}) {
  // Return the resulting value to the caller.
  return setSessionState(sessionId, {
    // Provide the payment status field value.
    payment_status: 'paid',
    // Provide the status field value.
    status: 'complete',
    // Spread patch into the surrounding structure.
    ...patch,
  });
}

/**
 * mark unpaid open — mutates persisted state when applicable.
 * @param {string|number} sessionId
 * @returns {*}
 */
function markUnpaidOpen(sessionId) {
  // Return the resulting value to the caller.
  return setSessionState(sessionId, {
    // Provide the payment status field value.
    payment_status: 'unpaid',
    // Provide the status field value.
    status: 'open',
  });
}

/**
 * expire session.
 * @param {string|number} sessionId
 * @returns {*}
 */
function expireSession(sessionId) {
  // Create the session constant.
  const session = sessions.get(sessionId);
  // Evaluate the condition and enter the branch when it is true.
  if (session) {
    // Update session.status with the right-hand side value.
    session.status = 'expired';
    // Status / lifecycle guard before mutating domain state.
    if (session.payment_status !== 'paid') {
      // Update session.payment_status with the right-hand side value.
      session.payment_status = 'unpaid';
    }
  }
  // Return the resulting value to the caller.
  return session ? { ...session } : null;
}

/**
 * fail next create session.
 * @returns {*}
 */
function failNextCreateSession() {
  // Update failNextCreate with the right-hand side value.
  failNextCreate = true;
}

/**
 * set next create overrides — mutates persisted state when applicable.
 * @param {*} overrides
 * @returns {*}
 */
function setNextCreateOverrides(overrides) {
  // Update createOverrides with the right-hand side value.
  createOverrides = overrides ? { ...overrides } : null;
}

/**
 * Insert orphan paid session and return the mapped result.
 * @param {object} params
 * @returns {*}
 */
function createOrphanPaidSession({ amountTotal = 10000, currency = 'eur' } = {}) {
  // Call setNextCreateOverrides to perform this step.
  setNextCreateOverrides({
    // Provide the orphan field value.
    orphan: true,
    // Provide the payment status field value.
    paymentStatus: 'paid',
    // Provide the status field value.
    status: 'complete',
    // Contribute this line to the enclosing declaration or statement.
    amountTotal,
    // Contribute this line to the enclosing declaration or statement.
    currency,
    // Provide the client reference id field value.
    clientReferenceId: null,
  });
  // Return the resulting value to the caller.
  return createSession({
    // Provide the pricing field value.
    pricing: { totalPrice: amountTotal / 100 },
  });
}

/**
 * Ensure payment intent from session exists or is initialized.
 * @param {object} session
 * @returns {*}
 */
function ensurePaymentIntentFromSession(session) {
  // Create the pi id constant.
  const piId = String(session.payment_intent);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!paymentIntents.has(piId)) {
    // Call paymentIntents.set to perform this step.
    paymentIntents.set(piId, {
      // Provide the id field value.
      id: piId,
      // Provide the amount received field value.
      amount_received: Number(session.amount_total) || 0,
      // Provide the amount refunded field value.
      amount_refunded: 0,
      // Provide the currency field value.
      currency: session.currency || 'eur',
    });
  }
  // Return the resulting value to the caller.
  return paymentIntents.get(piId);
}

/**
 * remaining of.
 * @param {*} pi
 * @returns {*}
 */
function remainingOf(pi) {
  // Return the resulting value to the caller.
  return Math.max(0, Number(pi.amount_received || 0) - Number(pi.amount_refunded || 0));
}

/**
 * Load or create payment intent.
 * @param {string|number} paymentIntentId
 * @param {number} [fallbackAmount]
 * @returns {*}
 */
function getOrCreatePaymentIntent(paymentIntentId, fallbackAmount = null) {
  // Create the id constant.
  const id = String(paymentIntentId);
  // Evaluate the condition and enter the branch when it is true.
  if (paymentIntents.has(id)) {
    // Return the resulting value to the caller.
    return paymentIntents.get(id);
  }

  // Iterate using the loop initializer, condition, and step.
  for (const session of sessions.values()) {
    // Stripe / payment-related branch.
    if (String(session.payment_intent) === id) {
      // Return the resulting value to the caller.
      return ensurePaymentIntentFromSession(session);
    }
  }

  // Create the amount constant.
  const amount = fallbackAmount != null ? Number(fallbackAmount) : 10000;
  // Create the pi constant.
  const pi = {
    // Contribute this line to the enclosing declaration or statement.
    id,
    // Provide the amount received field value.
    amount_received: Number.isFinite(amount) && amount > 0 ? amount : 10000,
    // Provide the amount refunded field value.
    amount_refunded: 0,
    // Provide the currency field value.
    currency: 'eur',
  };
  // Call paymentIntents.set to perform this step.
  paymentIntents.set(id, pi);
  // Return the resulting value to the caller.
  return pi;
}

/**
 * retrieve payment intent.
 * @param {string|number} paymentIntentId
 * @param {*} [{ expand }]
 * @returns {*}
 */
function retrievePaymentIntent(paymentIntentId, { expand } = {}) {
  // Create the pi constant.
  const pi = getOrCreatePaymentIntent(paymentIntentId);
  // Create the captured constant.
  const captured = Number(pi.amount_received) || 0;
  // Create the result constant.
  const result = {
    // Provide the id field value.
    id: pi.id,
    // Provide the object field value.
    object: 'payment_intent',
    // Provide the amount field value.
    amount: captured,
    // Provide the amount received field value.
    amount_received: captured,
    // Provide the currency field value.
    currency: pi.currency || 'eur',
    // Provide the latest charge field value.
    latest_charge: `ch_test_${pi.id}`,
  };

  // Evaluate the condition and enter the branch when it is true.
  if (expand && expand.includes('latest_charge')) {
    // Update result.latest_charge with the right-hand side value.
    result.latest_charge = {
      // Provide the id field value.
      id: `ch_test_${pi.id}`,
      // Provide the object field value.
      object: 'charge',
      // Provide the amount field value.
      amount: captured,
      // Provide the amount captured field value.
      amount_captured: captured,
      // Provide the amount refunded field value.
      amount_refunded: Number(pi.amount_refunded) || 0,
      // Provide the currency field value.
      currency: pi.currency || 'eur',
    };
  }

  // Return the resulting value to the caller.
  return result;
}

/**
 * fail next create refund.
 * @returns {*}
 */
function failNextCreateRefund() {
  // Update failNextRefund with the right-hand side value.
  failNextRefund = true;
}

/**
 * throw next create refund after recording.
 * @returns {*}
 */
function throwNextCreateRefundAfterRecording() {
  // Update throwNextRefundAfterRecording with the right-hand side value.
  throwNextRefundAfterRecording = true;
}

/**
 * set next refund status — mutates persisted state when applicable.
 * @param {string} status
 * @returns {*}
 */
function setNextRefundStatus(status) {
  // Update nextRefundStatus with the right-hand side value.
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
    // Return the resulting value to the caller.
    return { ...refundsByIdempotency.get(idempotencyKey) };
  }

  // Evaluate the condition and enter the branch when it is true.
  if (failNextRefund) {
    // Update failNextRefund with the right-hand side value.
    failNextRefund = false;
    // Create the err constant.
    const err = new Error('Stripe stub forced refund failure');
    // Update err.type with the right-hand side value.
    err.type = 'StripeAPIError';
    // Update err.code with the right-hand side value.
    err.code = 'refund_failed';
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Update refundCounter with the right-hand side value.
  refundCounter += 1;
  // Create the status constant.
  const status = nextRefundStatus || 'succeeded';
  // Update nextRefundStatus with the right-hand side value.
  nextRefundStatus = null;

  // Create the pi constant.
  const pi = getOrCreatePaymentIntent(paymentIntentId, amountCents);
  // Initialize the mutable amount variable.
  let amount = amountCents;
  // Guard: early-return or throw when required input is missing/invalid.
  if (amount == null) {
    // Update amount with the right-hand side value.
    amount = remainingOf(pi);
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (amount == null) {
    // Update amount with the right-hand side value.
    amount = 10000;
  }

  // Create the remaining constant.
  const remaining = remainingOf(pi);
  // Evaluate the condition and enter the branch when it is true.
  if (Number(amount) > remaining) {
    // Create the err constant.
    const err = new Error(
      // Continue the surrounding logic with this statement.
      `The refund amount (${amount}) exceeds the remaining refundable amount (${remaining})`
    );
    // Update err.type with the right-hand side value.
    err.type = 'StripeInvalidRequestError';
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the refund constant.
  const refund = {
    // Provide the id field value.
    id: `re_test_${refundCounter}${Date.now()}`,
    // Provide the object field value.
    object: 'refund',
    // Provide the amount field value.
    amount: Number(amount),
    // Provide the currency field value.
    currency: pi.currency || 'eur',
    // Provide the payment intent field value.
    payment_intent: String(paymentIntentId),
    // Contribute this line to the enclosing declaration or statement.
    status,
  };

  // Call refunds.set to perform this step.
  refunds.set(refund.id, refund);
  // Idempotency guard: return early when work was already applied.
  if (idempotencyKey) {
    // Call refundsByIdempotency.set to perform this step.
    refundsByIdempotency.set(idempotencyKey, refund);
  }
  // Update pi.amount_refunded with the right-hand side value.
  pi.amount_refunded = Number(pi.amount_refunded || 0) + Number(amount);

  // Refund exists at Stripe but the HTTP response failed — callers must reconcile.
  if (throwNextRefundAfterRecording) {
    // Update throwNextRefundAfterRecording with the right-hand side value.
    throwNextRefundAfterRecording = false;
    // Create the err constant.
    const err = new Error('Stripe stub timeout after recording refund');
    // Update err.type with the right-hand side value.
    err.type = 'StripeConnectionError';
    // Update err.code with the right-hand side value.
    err.code = 'ETIMEDOUT';
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Return the resulting value to the caller.
  return { ...refund };
}

/**
 * retrieve refund.
 * @param {string|number} refundId
 * @returns {*}
 */
function retrieveRefund(refundId) {
  // Create the refund constant.
  const refund = refunds.get(refundId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!refund) {
    // Create the err constant.
    const err = new Error(`No such refund: ${refundId}`);
    // Update err.type with the right-hand side value.
    err.type = 'StripeInvalidRequestError';
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Return the resulting value to the caller.
  return { ...refund };
}

/**
 * set refund state — mutates persisted state when applicable.
 * @param {string|number} refundId
 * @param {object} [patch]
 * @returns {*}
 */
function setRefundState(refundId, patch = {}) {
  // Create the refund constant.
  const refund = refunds.get(refundId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!refund) {
    // Create the err constant.
    const err = new Error(`No such refund: ${refundId}`);
    // Update err.type with the right-hand side value.
    err.type = 'StripeInvalidRequestError';
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Call Object.assign to perform this step.
  Object.assign(refund, patch);
  // Return the resulting value to the caller.
  return { ...refund };
}

/** Reset all stub state between tests. */
function clearSessions() {
  // Call sessions.clear to perform this step.
  sessions.clear();
  // Call sessionsByIdempotency.clear to perform this step.
  sessionsByIdempotency.clear();
  // Call refunds.clear to perform this step.
  refunds.clear();
  // Call refundsByIdempotency.clear to perform this step.
  refundsByIdempotency.clear();
  // Call paymentIntents.clear to perform this step.
  paymentIntents.clear();
  // Update counter with the right-hand side value.
  counter = 0;
  // Update refundCounter with the right-hand side value.
  refundCounter = 0;
  // Update failNextCreate with the right-hand side value.
  failNextCreate = false;
  // Update failNextRefund with the right-hand side value.
  failNextRefund = false;
  // Update throwNextRefundAfterRecording with the right-hand side value.
  throwNextRefundAfterRecording = false;
  // Update nextRefundStatus with the right-hand side value.
  nextRefundStatus = null;
  // Update createOverrides with the right-hand side value.
  createOverrides = null;
  // Call clearCreateSessionGate to perform this step.
  clearCreateSessionGate();
}

/**
 * Whether STRIPE_STUB env enables this in-memory driver.
 * @returns {boolean}
 */
function isStubEnabled() {
  // Return the resulting value to the caller.
  return ['1', 'true', 'yes'].includes(String(process.env.STRIPE_STUB || '').toLowerCase());
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createSession,
  // Contribute this line to the enclosing declaration or statement.
  retrieveSession,
  // Contribute this line to the enclosing declaration or statement.
  setSessionState,
  // Contribute this line to the enclosing declaration or statement.
  markPaid,
  // Contribute this line to the enclosing declaration or statement.
  markUnpaidOpen,
  // Contribute this line to the enclosing declaration or statement.
  expireSession,
  // Contribute this line to the enclosing declaration or statement.
  failNextCreateSession,
  // Contribute this line to the enclosing declaration or statement.
  armCreateSessionGate,
  // Contribute this line to the enclosing declaration or statement.
  waitForCreateSession,
  // Contribute this line to the enclosing declaration or statement.
  releaseCreateSessionGate,
  // Contribute this line to the enclosing declaration or statement.
  setNextCreateOverrides,
  // Contribute this line to the enclosing declaration or statement.
  createOrphanPaidSession,
  // Contribute this line to the enclosing declaration or statement.
  createRefund,
  // Contribute this line to the enclosing declaration or statement.
  retrieveRefund,
  // Contribute this line to the enclosing declaration or statement.
  retrievePaymentIntent,
  // Contribute this line to the enclosing declaration or statement.
  setRefundState,
  // Contribute this line to the enclosing declaration or statement.
  failNextCreateRefund,
  // Contribute this line to the enclosing declaration or statement.
  throwNextCreateRefundAfterRecording,
  // Contribute this line to the enclosing declaration or statement.
  setNextRefundStatus,
  // Contribute this line to the enclosing declaration or statement.
  clearSessions,
  // Contribute this line to the enclosing declaration or statement.
  isStubEnabled,
  // Contribute this line to the enclosing declaration or statement.
  sessions,
  // Contribute this line to the enclosing declaration or statement.
  refunds,
};
