/**
 * SSE stream controller for admin live events.
 */

const hub = require('./realtime.hub');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');

/**
 * Snapshot the staff identity that must authorize every later SSE frame.
 * @param {import('express').Request} req
 * @returns {{ userId: string|null, roles: string[], permissions: string[] }}
 */
function accessFromRequest(req) {
  // Create the user constant.
  const user = req.session?.user || {};
  // Return the resulting value to the caller.
  return {
    // Provide the user id field value.
    userId: user.id != null ? String(user.id) : null,
    // Provide the roles field value.
    roles: Array.isArray(user.roles) ? user.roles : [],
    // Provide the permissions field value.
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

/**
 * GET /api/admin/realtime/stream — staff-only SSE feed.
 * Honors Last-Event-ID / lastEventId for reconnect replay from the hub ring buffer.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.stream = asyncHandler(async (req, res) => {
  // Prefer standard Last-Event-ID header; fall back to query for proxy quirks.
  const lastEventId =
    // Contribute this line to the enclosing declaration or statement.
    req.headers['last-event-id'] ||
    // Continue the surrounding logic with this statement.
    (typeof req.query.lastEventId === 'string' ? req.query.lastEventId : null);

  // SSE response headers: disable buffering so events flush promptly.
  res.status(200);
  // Call res.setHeader to perform this step.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  // Call res.setHeader to perform this step.
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  // Call res.setHeader to perform this step.
  res.setHeader('Connection', 'keep-alive');
  // Call res.setHeader to perform this step.
  res.setHeader('X-Accel-Buffering', 'no');
  // Evaluate the condition and enter the branch when it is true.
  if (typeof res.flushHeaders === 'function') {
    // Call res.flushHeaders to perform this step.
    res.flushHeaders();
  }

  // Comment frame so the client knows the socket is open before replay/live events.
  res.write(`: connected\n\n`);

  // Create the subscriber id constant.
  const subscriberId = hub.subscribe(res, {
    // Contribute this line to the enclosing declaration or statement.
    lastEventId,
    // Provide the access field value.
    access: accessFromRequest(req),
    // Provide the session id field value.
    sessionId: req.sessionID,
  });

  // Tear down hub registration when the client disconnects or aborts.
  const cleanup = () => {
    // Call hub.unsubscribe to perform this step.
    hub.unsubscribe(subscriberId);
  };

  // Call req.on to perform this step.
  req.on('close', cleanup);
  // Call req.on to perform this step.
  req.on('aborted', cleanup);
});
