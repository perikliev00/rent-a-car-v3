/**
 * Creates a short-lived browser WebRTC call through the server-owned OpenAI key.
 * Disabled by default. No permanent API key or raw OpenAI error goes to the SPA.
 */
const express = require('express');
const crypto = require('crypto');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');
const { createLimiter } = require('../../middleware/rateLimit');
const { buildSessionConfig } = require('../../modules/voiceAgent/sessionConfig');

const router = express.Router();
const voiceLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 4 });

router.post('/session', voiceLimiter, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (process.env.VOICE_AGENT_ENABLED !== 'true') {
    return apiResponse.error(res, 'NOT_FOUND', 'Voice assistant is disabled.', 404);
  }
  if (!process.env.OPENAI_API_KEY) {
    return apiResponse.error(res, 'VOICE_UNAVAILABLE', 'Voice assistant is not configured.', 503);
  }
  // Reject API-key machine clients: they skip the global cookie CSRF middleware.
  if (req.apiKey) {
    return apiResponse.error(res, 'FORBIDDEN', 'Browser session required.', 403);
  }
  const { sdp, language } = req.body || {};
  if (typeof sdp !== 'string' || sdp.length < 20 || sdp.length > 20_000 ||
      !sdp.startsWith('v=0') || !['bg', 'en'].includes(language)) {
    return apiResponse.error(res, 'VALIDATION_ERROR', 'Invalid voice session request.', 422);
  }

  const form = new FormData();
  form.set('sdp', sdp);
  form.set('session', JSON.stringify(buildSessionConfig(language)));
  // Privacy-preserving identifier, unrelated to the customer's actual identity.
  const safetyId = crypto.createHmac('sha256', process.env.SESSION_SECRET)
    .update(String(req.sessionID)).digest('hex');
  try {
    const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
        'OpenAI-Safety-Identifier': safetyId,
      },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      logger.warn({ status: upstream.status }, 'Voice WebRTC call setup failed');
      return apiResponse.error(res, 'VOICE_UNAVAILABLE', 'Could not start voice call.', 502);
    }
    const answer = await upstream.text();
    if (!answer.startsWith('v=0')) {
      return apiResponse.error(res, 'VOICE_UNAVAILABLE', 'Invalid voice session response.', 502);
    }
    return apiResponse.success(res, { sdp: answer });
  } catch (err) {
    logger.warn({ name: err.name }, 'Voice WebRTC setup network failure');
    return apiResponse.error(res, 'VOICE_UNAVAILABLE', 'Voice service is temporarily unavailable.', 502);
  }
}));

module.exports = router;
