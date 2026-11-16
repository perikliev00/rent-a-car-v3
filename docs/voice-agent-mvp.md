# LuxRide AI Voice: browser MVP

**Status:** feature behind two independent flags; no production enablement, no SIP/phone integration, no write tools.

## Architecture

Browser microphone -> WebRTC -> OpenAI Realtime, with SDP exchange on POST /api/v1/voice/session.
The API sends the model configuration and SDP to OpenAI using a server-only OPENAI_API_KEY.
No API key is sent to the browser. The WebRTC data channel receives read-only function calls.
The client dispatches search_available_cars through the existing /api/v1/cars/search API,
which checks actual trip dates, filters availability and computes trip pricing.
The UI exposes a link to /search with those criteria. A reservation is **not created**
until the customer follows the standard booking flow.

## Configuration

- Backend: VOICE_AGENT_ENABLED=true and OPENAI_API_KEY=... (server secret only).
- Customer frontend: VITE_VOICE_AGENT_ENABLED=true (rebuild the frontend).
- Both default to OFF. Keep them OFF in production until evaluated.
- Requires HTTPS (localhost exception), microphone permissions and OpenAI API billing.
- The model defaults to gpt-realtime-2.1-mini, English/Bulgarian, voice marin.
- Server rate limit: 4 session creation attempts per IP per 15 minutes.
- Browser ends a call after at most five minutes. This is not a server-side billing
  cap against a modified client. Set a strict spend limit in your OpenAI project.

## Verification before rollout

1. Run normal CI: backend Jest, frontend Vitest/check/build, database/integration and E2E.
2. With mocked OpenAI SDP exchange, verify missing/invalid SDP, disabled flags,
   absent key, CSRF enforcement, rate-limit and upstream failure.
3. Manual test HTTPS Chromium/Firefox/Android microphone permission, mute,
   disconnect, close during connect, timeout, BG/EN quality and accessibility.
4. Check tool responses against real available/unavailable dates and concurrent holds.
   Search results are previews, never guaranteed inventory or final price.
5. Verify no PII, full car records, API keys or voice transcripts in logs.
6. Confirm OpenAI cost/spend alert and GDPR privacy notice before enabling publicly.

## Limitations / next steps

No automatic reservation holds, emails, customer identity verification, telephone calls
or handoff to a human agent. Search results are shown in-site, and the customer completes
their own hold/Stripe Checkout with the existing code. The frontend currently handles
tool calls over WebRTC, so a malicious browser can edit the tool output to the model:
all resulting information remains untrusted until existing booking services verify it.
For phone use, add verified SIP webhooks and server-side session/tool execution.

Docs: https://developers.openai.com/api/docs/guides/voice-webrtc
      https://developers.openai.com/api/docs/guides/realtime-mcp
