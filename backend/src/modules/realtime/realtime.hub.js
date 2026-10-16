/**
 * In-memory SSE hub for admin live events.
 *
 * v1: single-process only. Multi-instance deploys need sticky sessions
 * or a shared pub/sub (e.g. Redis) so publishes reach all API nodes.
 */

const HEARTBEAT_MS = 20_000;
const RING_BUFFER_SIZE = 50;

/** @type {Map<string, { res: import('express').Response, lastEventId: string | null }>} */
const subscribers = new Map();

/** @type {Array<{ id: string, type: string, payload: object }>} */
const ringBuffer = [];

let subscriberSeq = 0;
let heartbeatTimer = null;

/**
 * Start keepalive pings so proxies do not close idle SSE connections.
 * Idempotent: only one interval is created while any subscriber is connected.
 */
function ensureHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    // Ping every subscriber; drop dead sockets that throw on write.
    for (const [id, sub] of subscribers.entries()) {
      try {
        sub.res.write(`: ping\n\n`);
        // Named ping event for clients that listen for event: ping
        sub.res.write(`event: ping\ndata: {"ok":true}\n\n`);
      } catch {
        subscribers.delete(id);
      }
    }
    // Stop the timer when the last subscriber disconnects.
    if (subscribers.size === 0) {
      stopHeartbeat();
    }
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
 * Append an event to the ring buffer, trimming oldest entries past RING_BUFFER_SIZE.
 * Used for Last-Event-ID replay on reconnect.
 * @param {{ id: string, type: string, payload: object }} entry
 */
function pushToRing(entry) {
  ringBuffer.push(entry);
  while (ringBuffer.length > RING_BUFFER_SIZE) {
    ringBuffer.shift();
  }
}

/**
 * Write one SSE message (id, event name, JSON data) to a response stream.
 * @param {import('express').Response} res
 * @param {{ id: string, type: string, payload: object }} event
 */
function writeSse(res, { id, type, payload }) {
  res.write(`id: ${id}\n`);
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Events after lastEventId; if id unknown, replay the whole ring (best-effort catch-up).
 * @param {string|null} lastEventId
 * @returns {Array<{ id: string, type: string, payload: object }>}
 */
function eventsAfter(lastEventId) {
  if (!lastEventId) return [];
  const idx = ringBuffer.findIndex((e) => e.id === lastEventId);
  // Unknown id → client may have missed the whole window; replay everything.
  if (idx < 0) return [...ringBuffer];
  return ringBuffer.slice(idx + 1);
}

/**
 * Fan-out a live event to all subscribers and retain it in the ring buffer.
 * @param {object} event - full live event payload (must include id + type)
 */
function publish(event) {
  // Ignore malformed events so a bad publisher cannot poison the hub.
  if (!event || !event.id || !event.type) {
    return event;
  }

  const entry = { id: event.id, type: event.type, payload: event };
  pushToRing(entry);

  // Write to every open SSE connection; prune sockets that fail.
  for (const [id, sub] of subscribers.entries()) {
    try {
      writeSse(sub.res, entry);
    } catch {
      subscribers.delete(id);
    }
  }

  return event;
}

/**
 * Register an SSE response as a subscriber and optionally replay missed events.
 * @param {import('express').Response} res
 * @param {{ lastEventId?: string | null }} [opts]
 * @returns {string} subscriber id
 */
function subscribe(res, opts = {}) {
  subscriberSeq += 1;
  const id = `sub-${subscriberSeq}`;
  const lastEventId = opts.lastEventId || null;

  subscribers.set(id, { res, lastEventId });
  ensureHeartbeat();

  // Best-effort catch-up from the ring buffer before live traffic resumes.
  const replay = eventsAfter(lastEventId);
  for (const entry of replay) {
    try {
      writeSse(res, entry);
    } catch {
      // Replay write failed — drop this subscriber immediately.
      subscribers.delete(id);
      return id;
    }
  }

  return id;
}

/**
 * Remove a subscriber; stop heartbeat when the last connection closes.
 * @param {string} subscriberId
 */
function unsubscribe(subscriberId) {
  subscribers.delete(subscriberId);
  if (subscribers.size === 0) {
    stopHeartbeat();
  }
}

/**
 * End all SSE responses and clear subscribers (used on process shutdown / tests).
 */
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

/** @returns {number} Current open SSE subscriber count. */
function getSubscriberCount() {
  return subscribers.size;
}

/** @returns {Array<{ id: string, type: string, payload: object }>} Shallow copy of the ring buffer. */
function getRingBuffer() {
  return [...ringBuffer];
}

/**
 * Test helper: tear down connections and reset ring / sequence state.
 * @private
 */
function _resetForTests() {
  closeAll();
  ringBuffer.length = 0;
  subscriberSeq = 0;
}

module.exports = {
  publish,
  subscribe,
  unsubscribe,
  closeAll,
  getSubscriberCount,
  getRingBuffer,
  eventsAfter,
  HEARTBEAT_MS,
  RING_BUFFER_SIZE,
  _resetForTests,
};
