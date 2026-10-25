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
  authorizeLiveEvent,
  redactLiveEvent,
  authFingerprint,
} = require('./realtime.accessPolicy');

const HEARTBEAT_MS = 20_000;
const RING_BUFFER_SIZE = 50;
const MAX_SSE_LIFETIME_MS = 15 * 60 * 1000;

/** @type {Map<string, object>} */
const subscribers = new Map();

/** @type {Array<{ id: string, type: string, payload: object }>} */
const ringBuffer = [];

let subscriberSeq = 0;
let heartbeatTimer = null;
let sessionLookup = null;

/**
 * @param {Function|null} lookup
 */
function setSessionLookup(lookup) {
  sessionLookup = typeof lookup === 'function' ? lookup : null;
}

/**
 * Start keepalive pings and session revalidation.
 * Idempotent: only one interval is created while any subscriber is connected.
 */
function ensureHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    void (async () => {
      try {
        await revalidateSubscribers();
      } catch {
        // Per-subscriber failures are handled inside revalidateSubscribers.
      }
      for (const [id, sub] of subscribers.entries()) {
        try {
          sub.res.write(`: ping\n\n`);
          sub.res.write(`event: ping\ndata: {"ok":true}\n\n`);
        } catch {
          subscribers.delete(id);
        }
      }
      if (subscribers.size === 0) {
        stopHeartbeat();
      }
    })();
  }, HEARTBEAT_MS);
  heartbeatTimer.unref?.();
}

/** Clear the heartbeat interval when no subscribers remain. */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * @param {{ id: string, type: string, payload: object }} entry
 */
function pushToRing(entry) {
  ringBuffer.push(entry);
  while (ringBuffer.length > RING_BUFFER_SIZE) {
    ringBuffer.shift();
  }
}

/**
 * @param {import('express').Response} res
 * @param {{ id: string, type: string, payload: object }} event
 */
function writeSse(res, { id, type, payload }) {
  res.write(`id: ${id}\n`);
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * @param {import('express').Response} res
 * @param {{ id: string, type: string, payload: object }} entry
 * @param {object|null} access
 * @returns {boolean} True when the event was written
 */
function deliver(res, entry, access) {
  const decision = authorizeLiveEvent(access, entry.payload);
  if (!decision.allow) return false;
  const payload = decision.redact ? redactLiveEvent(entry.payload) : entry.payload;
  writeSse(res, { id: entry.id, type: entry.type, payload });
  return true;
}

/**
 * @param {string|null} lastEventId
 * @returns {Array<{ id: string, type: string, payload: object }>}
 */
function eventsAfter(lastEventId) {
  if (!lastEventId) return [];
  const idx = ringBuffer.findIndex((e) => e.id === lastEventId);
  if (idx < 0) return [...ringBuffer];
  return ringBuffer.slice(idx + 1);
}

/**
 * @param {object} event
 */
function publish(event) {
  if (!event || !event.id || !event.type) {
    return event;
  }

  const entry = { id: event.id, type: event.type, payload: event };
  pushToRing(entry);

  for (const [id, sub] of subscribers.entries()) {
    try {
      deliver(sub.res, entry, sub.access);
    } catch {
      subscribers.delete(id);
    }
  }

  return event;
}

/**
 * @param {import('express').Response} res
 * @param {{ lastEventId?: string|null, access?: object|null, sessionId?: string|null, connectedAt?: number, maxLifetimeMs?: number }} [opts]
 * @returns {string}
 */
function subscribe(res, opts = {}) {
  subscriberSeq += 1;
  const id = `sub-${subscriberSeq}`;
  const access = opts.access || null;
  const sessionId = opts.sessionId || null;

  subscribers.set(id, {
    res,
    lastEventId: opts.lastEventId || null,
    access,
    sessionId,
    userId: access && access.userId != null ? String(access.userId) : null,
    connectedAt: opts.connectedAt || Date.now(),
    maxLifetimeMs: opts.maxLifetimeMs || MAX_SSE_LIFETIME_MS,
    authFingerprint: authFingerprint(access),
  });
  ensureHeartbeat();

  const replay = eventsAfter(opts.lastEventId || null);
  for (const entry of replay) {
    try {
      deliver(res, entry, access);
    } catch {
      subscribers.delete(id);
      return id;
    }
  }

  return id;
}

/**
 * @param {string} subscriberId
 * @param {string} reason
 */
function closeSubscriber(subscriberId, reason) {
  const sub = subscribers.get(subscriberId);
  if (!sub) return;
  subscribers.delete(subscriberId);
  try {
    sub.res.write(`event: session_revoked\ndata: ${JSON.stringify({ reason })}\n\n`);
    sub.res.end();
  } catch {
    // The socket may already be gone.
  }
  if (subscribers.size === 0) {
    stopHeartbeat();
  }
}

/**
 * @param {string} subscriberId
 */
function unsubscribe(subscriberId) {
  subscribers.delete(subscriberId);
  if (subscribers.size === 0) {
    stopHeartbeat();
  }
}

/**
 * @param {string|number} userId
 */
function revokeUser(userId) {
  const target = String(userId);
  for (const [id, sub] of [...subscribers.entries()]) {
    if (sub.userId === target) closeSubscriber(id, 'revoked');
  }
}

/**
 * @param {string} sessionId
 */
function revokeSession(sessionId) {
  if (!sessionId) return;
  for (const [id, sub] of [...subscribers.entries()]) {
    if (sub.sessionId === sessionId) closeSubscriber(id, 'logout');
  }
}

/**
 * Re-check lifetime, session existence, and authorization fingerprint.
 * @param {Function|null} [lookup]
 * @returns {Promise<void>}
 */
async function revalidateSubscribers(lookup = sessionLookup) {
  const now = Date.now();
  for (const [id, sub] of [...subscribers.entries()]) {
    if (now - sub.connectedAt >= sub.maxLifetimeMs) {
      closeSubscriber(id, 'max_lifetime');
      continue;
    }
    if (typeof lookup !== 'function' || !sub.sessionId) continue;
    try {
      const state = await lookup(sub.sessionId);
      if (!state || state.valid !== true) {
        closeSubscriber(id, 'session_invalid');
        continue;
      }
      const nextAccess = state.access || sub.access;
      const nextFingerprint = authFingerprint(nextAccess);
      if (nextFingerprint !== sub.authFingerprint) {
        closeSubscriber(id, 'authorization_changed');
        continue;
      }
      sub.access = nextAccess;
    } catch {
      closeSubscriber(id, 'revalidation_failed');
    }
  }
}

function closeAll() {
  for (const [id, sub] of subscribers.entries()) {
    try {
      sub.res.end();
    } catch {
      // ignore write errors while tearing down
    }
    subscribers.delete(id);
  }
  stopHeartbeat();
}

function getSubscriberCount() {
  return subscribers.size;
}

function getRingBuffer() {
  return [...ringBuffer];
}

function _resetForTests() {
  closeAll();
  ringBuffer.length = 0;
  subscriberSeq = 0;
  sessionLookup = null;
}

module.exports = {
  publish,
  subscribe,
  unsubscribe,
  closeAll,
  closeSubscriber,
  revokeUser,
  revokeSession,
  revalidateSubscribers,
  setSessionLookup,
  getSubscriberCount,
  getRingBuffer,
  eventsAfter,
  HEARTBEAT_MS,
  RING_BUFFER_SIZE,
  MAX_SSE_LIFETIME_MS,
  _resetForTests,
};
