/**
 * SSE stream controller for admin live events.
 */

const hub = require('./realtime.hub');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/admin/realtime/stream — staff-only SSE feed.
 * Honors Last-Event-ID / lastEventId for reconnect replay from the hub ring buffer.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.stream = asyncHandler(async (req, res) => {
  // Prefer standard Last-Event-ID header; fall back to query for proxy quirks.
  const lastEventId =
    req.headers['last-event-id'] ||
    (typeof req.query.lastEventId === 'string' ? req.query.lastEventId : null);

  // SSE response headers: disable buffering so events flush promptly.
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Comment frame so the client knows the socket is open before replay/live events.
  res.write(`: connected\n\n`);

  const subscriberId = hub.subscribe(res, { lastEventId });

  // Tear down hub registration when the client disconnects or aborts.
  const cleanup = () => {
    hub.unsubscribe(subscriberId);
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
});
