const hub = require('./realtime.hub');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/admin/realtime/stream — staff-only SSE feed.
 */
exports.stream = asyncHandler(async (req, res) => {
  const lastEventId =
    req.headers['last-event-id'] ||
    (typeof req.query.lastEventId === 'string' ? req.query.lastEventId : null);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  // Flush headers immediately for proxies
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(`: connected\n\n`);

  const subscriberId = hub.subscribe(res, { lastEventId });

  const cleanup = () => {
    hub.unsubscribe(subscriberId);
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
});
