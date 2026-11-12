/**
 * In-memory SSE hub for admin live events.
 *
 * Each subscriber carries the session identity captured at connect time.
 * Live delivery and Last-Event-ID replay use the same authorization policy.
 * Logout and role changes close same-process streams immediately. Other API
 * processes drop the stream on the next heartbeat after the session row is
 * gone or the stored permission fingerprint changes.
 */

const {
  // Contribute this line to the enclosing declaration or statement.
  authorizeLiveEvent,
  // Contribute this line to the enclosing declaration or statement.
  redactLiveEvent,
  // Contribute this line to the enclosing declaration or statement.
  authFingerprint,
// Continue the surrounding logic with this statement.
} = require('./realtime.accessPolicy');

// Create the heartbeat ms constant.
const HEARTBEAT_MS = 20_000;
// Create the ring buffer size constant.
const RING_BUFFER_SIZE = 50;
// Create the max sse lifetime ms constant.
const MAX_SSE_LIFETIME_MS = 15 * 60 * 1000;

/** @type {Map<string, object>} */
const subscribers = new Map();

/** @type {Array<{ id: string, type: string, payload: object }>} */
const ringBuffer = [];

// Initialize the mutable subscriber seq variable.
let subscriberSeq = 0;
// Initialize the mutable heartbeat timer variable.
let heartbeatTimer = null;
// Initialize the mutable session lookup variable.
let sessionLookup = null;

/**
 * @param {Function|null} lookup
 */
function setSessionLookup(lookup) {
  // Update sessionLookup with the right-hand side value.
  sessionLookup = typeof lookup === 'function' ? lookup : null;
}

/**
 * Start keepalive pings and session revalidation.
 * Idempotent: only one interval is created while any subscriber is connected.
 */
function ensureHeartbeat() {
  // Evaluate the condition and enter the branch when it is true.
  if (heartbeatTimer) return;
  // Update heartbeatTimer with the right-hand side value.
  heartbeatTimer = setInterval(() => {
    // Call void to perform this step.
    void (async () => {
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await revalidateSubscribers();
      // Contribute this line to the enclosing declaration or statement.
      } catch {
        // Per-subscriber failures are handled inside revalidateSubscribers.
      }
      // Iterate using the loop initializer, condition, and step.
      for (const [id, sub] of subscribers.entries()) {
        // Start a try block for operations that may fail.
        try {
          // Call sub.res.write to perform this step.
          sub.res.write(`: ping\n\n`);
          // Call sub.res.write to perform this step.
          sub.res.write(`event: ping\ndata: {"ok":true}\n\n`);
        // Contribute this line to the enclosing declaration or statement.
        } catch {
          // Call subscribers.delete to perform this step.
          subscribers.delete(id);
        }
      }
      // Evaluate the condition and enter the branch when it is true.
      if (subscribers.size === 0) {
        // Call stopHeartbeat to perform this step.
        stopHeartbeat();
      }
    // Continue the surrounding logic with this statement.
    })();
  // Continue the surrounding logic with this statement.
  }, HEARTBEAT_MS);
  // Continue the surrounding logic with this statement.
  heartbeatTimer.unref?.();
}

/** Clear the heartbeat interval when no subscribers remain. */
function stopHeartbeat() {
  // Evaluate the condition and enter the branch when it is true.
  if (heartbeatTimer) {
    // Call clearInterval to perform this step.
    clearInterval(heartbeatTimer);
    // Update heartbeatTimer with the right-hand side value.
    heartbeatTimer = null;
  }
}

/**
 * @param {{ id: string, type: string, payload: object }} entry
 */
function pushToRing(entry) {
  // Call ringBuffer.push to perform this step.
  ringBuffer.push(entry);
  // Keep looping while the condition remains true.
  while (ringBuffer.length > RING_BUFFER_SIZE) {
    // Call ringBuffer.shift to perform this step.
    ringBuffer.shift();
  }
}

/**
 * @param {import('express').Response} res
 * @param {{ id: string, type: string, payload: object }} event
 */
function writeSse(res, { id, type, payload }) {
  // Call res.write to perform this step.
  res.write(`id: ${id}\n`);
  // Call res.write to perform this step.
  res.write(`event: ${type}\n`);
  // Call res.write to perform this step.
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * @param {import('express').Response} res
 * @param {{ id: string, type: string, payload: object }} entry
 * @param {object|null} access
 * @returns {boolean} True when the event was written
 */
function deliver(res, entry, access) {
  // Create the decision constant.
  const decision = authorizeLiveEvent(access, entry.payload);
  // Evaluate the condition and enter the branch when it is true.
  if (!decision.allow) return false;
  // Create the payload constant.
  const payload = decision.redact ? redactLiveEvent(entry.payload) : entry.payload;
  // Call writeSse to perform this step.
  writeSse(res, { id: entry.id, type: entry.type, payload });
  // Return the resulting value to the caller.
  return true;
}

/**
 * @param {string|null} lastEventId
 * @returns {Array<{ id: string, type: string, payload: object }>}
 */
function eventsAfter(lastEventId) {
  // Evaluate the condition and enter the branch when it is true.
  if (!lastEventId) return [];
  // Create the idx constant.
  const idx = ringBuffer.findIndex((e) => e.id === lastEventId);
  // Evaluate the condition and enter the branch when it is true.
  if (idx < 0) return [...ringBuffer];
  // Return the resulting value to the caller.
  return ringBuffer.slice(idx + 1);
}

/**
 * @param {object} event
 */
function publish(event) {
  // Evaluate the condition and enter the branch when it is true.
  if (!event || !event.id || !event.type) {
    // Return the resulting value to the caller.
    return event;
  }

  // Create the entry constant.
  const entry = { id: event.id, type: event.type, payload: event };
  // Call pushToRing to perform this step.
  pushToRing(entry);

  // Iterate using the loop initializer, condition, and step.
  for (const [id, sub] of subscribers.entries()) {
    // Start a try block for operations that may fail.
    try {
      // Call deliver to perform this step.
      deliver(sub.res, entry, sub.access);
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // Call subscribers.delete to perform this step.
      subscribers.delete(id);
    }
  }

  // Return the resulting value to the caller.
  return event;
}

/**
 * @param {import('express').Response} res
 * @param {{ lastEventId?: string|null, access?: object|null, sessionId?: string|null, connectedAt?: number, maxLifetimeMs?: number }} [opts]
 * @returns {string}
 */
function subscribe(res, opts = {}) {
  // Update subscriberSeq with the right-hand side value.
  subscriberSeq += 1;
  // Create the id constant.
  const id = `sub-${subscriberSeq}`;
  // Create the access constant.
  const access = opts.access || null;
  // Create the session id constant.
  const sessionId = opts.sessionId || null;

  // Call subscribers.set to perform this step.
  subscribers.set(id, {
    // Contribute this line to the enclosing declaration or statement.
    res,
    // Provide the last event id field value.
    lastEventId: opts.lastEventId || null,
    // Contribute this line to the enclosing declaration or statement.
    access,
    // Contribute this line to the enclosing declaration or statement.
    sessionId,
    // Provide the user id field value.
    userId: access && access.userId != null ? String(access.userId) : null,
    // Provide the connected at field value.
    connectedAt: opts.connectedAt || Date.now(),
    // Provide the max lifetime ms field value.
    maxLifetimeMs: opts.maxLifetimeMs || MAX_SSE_LIFETIME_MS,
    // Provide the auth fingerprint field value.
    authFingerprint: authFingerprint(access),
  });
  // Call ensureHeartbeat to perform this step.
  ensureHeartbeat();

  // Create the replay constant.
  const replay = eventsAfter(opts.lastEventId || null);
  // Iterate using the loop initializer, condition, and step.
  for (const entry of replay) {
    // Start a try block for operations that may fail.
    try {
      // Call deliver to perform this step.
      deliver(res, entry, access);
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // Call subscribers.delete to perform this step.
      subscribers.delete(id);
      // Return the resulting value to the caller.
      return id;
    }
  }

  // Return the resulting value to the caller.
  return id;
}

/**
 * @param {string} subscriberId
 * @param {string} reason
 */
function closeSubscriber(subscriberId, reason) {
  // Create the sub constant.
  const sub = subscribers.get(subscriberId);
  // Evaluate the condition and enter the branch when it is true.
  if (!sub) return;
  // Call subscribers.delete to perform this step.
  subscribers.delete(subscriberId);
  // Start a try block for operations that may fail.
  try {
    // Call sub.res.write to perform this step.
    sub.res.write(`event: session_revoked\ndata: ${JSON.stringify({ reason })}\n\n`);
    // Call sub.res.end to perform this step.
    sub.res.end();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // The socket may already be gone.
  }
  // Evaluate the condition and enter the branch when it is true.
  if (subscribers.size === 0) {
    // Call stopHeartbeat to perform this step.
    stopHeartbeat();
  }
}

/**
 * @param {string} subscriberId
 */
function unsubscribe(subscriberId) {
  // Call subscribers.delete to perform this step.
  subscribers.delete(subscriberId);
  // Evaluate the condition and enter the branch when it is true.
  if (subscribers.size === 0) {
    // Call stopHeartbeat to perform this step.
    stopHeartbeat();
  }
}

/**
 * @param {string|number} userId
 */
function revokeUser(userId) {
  // Create the target constant.
  const target = String(userId);
  // Iterate using the loop initializer, condition, and step.
  for (const [id, sub] of [...subscribers.entries()]) {
    // Evaluate the condition and enter the branch when it is true.
    if (sub.userId === target) closeSubscriber(id, 'revoked');
  }
}

/**
 * @param {string} sessionId
 */
function revokeSession(sessionId) {
  // Evaluate the condition and enter the branch when it is true.
  if (!sessionId) return;
  // Iterate using the loop initializer, condition, and step.
  for (const [id, sub] of [...subscribers.entries()]) {
    // Evaluate the condition and enter the branch when it is true.
    if (sub.sessionId === sessionId) closeSubscriber(id, 'logout');
  }
}

/**
 * Re-check lifetime, session existence, and authorization fingerprint.
 * @param {Function|null} [lookup]
 * @returns {Promise<void>}
 */
async function revalidateSubscribers(lookup = sessionLookup) {
  // Create the now constant.
  const now = Date.now();
  // Iterate using the loop initializer, condition, and step.
  for (const [id, sub] of [...subscribers.entries()]) {
    // Evaluate the condition and enter the branch when it is true.
    if (now - sub.connectedAt >= sub.maxLifetimeMs) {
      // Call closeSubscriber to perform this step.
      closeSubscriber(id, 'max_lifetime');
      // Continue with the next loop iteration.
      continue;
    }
    // Evaluate the condition and enter the branch when it is true.
    if (typeof lookup !== 'function' || !sub.sessionId) continue;
    // Start a try block for operations that may fail.
    try {
      // Create the state constant.
      const state = await lookup(sub.sessionId);
      // Evaluate the condition and enter the branch when it is true.
      if (!state || state.valid !== true) {
        // Call closeSubscriber to perform this step.
        closeSubscriber(id, 'session_invalid');
        // Continue with the next loop iteration.
        continue;
      }
      // Create the next access constant.
      const nextAccess = state.access || sub.access;
      // Create the next fingerprint constant.
      const nextFingerprint = authFingerprint(nextAccess);
      // Evaluate the condition and enter the branch when it is true.
      if (nextFingerprint !== sub.authFingerprint) {
        // Call closeSubscriber to perform this step.
        closeSubscriber(id, 'authorization_changed');
        // Continue with the next loop iteration.
        continue;
      }
      // Update sub.access with the right-hand side value.
      sub.access = nextAccess;
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // Call closeSubscriber to perform this step.
      closeSubscriber(id, 'revalidation_failed');
    }
  }
}

// Define the closeAll function.
function closeAll() {
  // Iterate using the loop initializer, condition, and step.
  for (const [id, sub] of subscribers.entries()) {
    // Start a try block for operations that may fail.
    try {
      // Call sub.res.end to perform this step.
      sub.res.end();
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // ignore write errors while tearing down
    }
    // Call subscribers.delete to perform this step.
    subscribers.delete(id);
  }
  // Call stopHeartbeat to perform this step.
  stopHeartbeat();
}

// Define the getSubscriberCount function.
function getSubscriberCount() {
  // Return the resulting value to the caller.
  return subscribers.size;
}

// Define the getRingBuffer function.
function getRingBuffer() {
  // Return the resulting value to the caller.
  return [...ringBuffer];
}

// Define the _resetForTests function.
function _resetForTests() {
  // Call closeAll to perform this step.
  closeAll();
  // Update ringBuffer.length with the right-hand side value.
  ringBuffer.length = 0;
  // Update subscriberSeq with the right-hand side value.
  subscriberSeq = 0;
  // Update sessionLookup with the right-hand side value.
  sessionLookup = null;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  publish,
  // Contribute this line to the enclosing declaration or statement.
  subscribe,
  // Contribute this line to the enclosing declaration or statement.
  unsubscribe,
  // Contribute this line to the enclosing declaration or statement.
  closeAll,
  // Contribute this line to the enclosing declaration or statement.
  closeSubscriber,
  // Contribute this line to the enclosing declaration or statement.
  revokeUser,
  // Contribute this line to the enclosing declaration or statement.
  revokeSession,
  // Contribute this line to the enclosing declaration or statement.
  revalidateSubscribers,
  // Contribute this line to the enclosing declaration or statement.
  setSessionLookup,
  // Contribute this line to the enclosing declaration or statement.
  getSubscriberCount,
  // Contribute this line to the enclosing declaration or statement.
  getRingBuffer,
  // Contribute this line to the enclosing declaration or statement.
  eventsAfter,
  // Contribute this line to the enclosing declaration or statement.
  HEARTBEAT_MS,
  // Contribute this line to the enclosing declaration or statement.
  RING_BUFFER_SIZE,
  // Contribute this line to the enclosing declaration or statement.
  MAX_SSE_LIFETIME_MS,
  // Contribute this line to the enclosing declaration or statement.
  _resetForTests,
};
