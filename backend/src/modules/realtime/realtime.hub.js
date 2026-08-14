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

function ensureHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const [id, sub] of subscribers.entries()) {
      try {
        sub.res.write(`: ping\n\n`);
        // Also send a named ping event for clients that listen for it
        sub.res.write(`event: ping\ndata: {"ok":true}\n\n`);
      } catch {
        subscribers.delete(id);
      }
    }
    if (subscribers.size === 0) {
      stopHeartbeat();
    }
  }, HEARTBEAT_MS);
  heartbeatTimer.unref?.();
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function pushToRing(entry) {
  ringBuffer.push(entry);
  while (ringBuffer.length > RING_BUFFER_SIZE) {
    ringBuffer.shift();
  }
}

function writeSse(res, { id, type, payload }) {
  res.write(`id: ${id}\n`);
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function eventsAfter(lastEventId) {
  if (!lastEventId) return [];
  const idx = ringBuffer.findIndex((e) => e.id === lastEventId);
  if (idx < 0) return [...ringBuffer];
  return ringBuffer.slice(idx + 1);
}

/**
 * @param {object} event - full live event payload (must include id + type)
 */
function publish(event) {
  if (!event || !event.id || !event.type) {
    return event;
  }

  const entry = { id: event.id, type: event.type, payload: event };
  pushToRing(entry);

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

  const replay = eventsAfter(lastEventId);
  for (const entry of replay) {
    try {
      writeSse(res, entry);
    } catch {
      subscribers.delete(id);
      return id;
    }
  }

  return id;
}

function unsubscribe(subscriberId) {
  subscribers.delete(subscriberId);
  if (subscribers.size === 0) {
    stopHeartbeat();
  }
}

function closeAll() {
  for (const [id, sub] of subscribers.entries()) {
    try {
      sub.res.end();
    } catch {
      // ignore
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

/** Test helper */
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
