/**
 * Security mail (email verification, guest booking claim).
 *
 * These messages carry raw single-use tokens, so they deliberately bypass the DB-backed
 * notifications queue: a queued row would persist the raw token in notifications.payload.
 * Delivery is attempted directly over SMTP and the result is reported back, but callers
 * must never treat a send failure as verified/claimed state.
 */

const { sendMail } = require('./emailService');
const { config } = require('../../config/env');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');
const metrics = require('../../monitoring/metrics');
const testOutbox = require('./testOutbox');

function frontendBase() {
  return String(config.frontendBaseUrl || '').replace(/\/+$/, '');
}

function buildVerificationUrl(rawToken) {
  return `${frontendBase()}/verify-email?token=${encodeURIComponent(rawToken)}`;
}

function buildClaimUrl(reservationId, rawToken) {
  return (
    `${frontendBase()}/claim-booking` +
    `?reservationId=${encodeURIComponent(reservationId)}` +
    `&token=${encodeURIComponent(rawToken)}`
  );
}

async function deliver({ to, subject, text, html, kind, context }) {
  testOutbox.record({ to, subject, text, html, kind });

  if (process.env.NODE_ENV === 'test') {
    return { sent: true, reason: 'test_outbox' };
  }

  try {
    const result = await sendMail({ to, subject, text, html });
    if (!result.sent) {
      logEvent.warn('security.email.not_sent', { kind, reason: result.reason, ...context });
      metrics.incrementSecurityEmailFailures(kind);
    }
    return result;
  } catch (err) {
    // Never rethrow: a mail transport problem must not roll back committed security state.
    logger.warn({ err, kind, ...context }, 'Security email delivery failed');
    logEvent.warn('security.email.failed', { kind, ...context });
    metrics.incrementSecurityEmailFailures(kind);
    return { sent: false, reason: 'delivery_error' };
  }
}

async function sendEmailVerificationEmail({ to, rawToken, expiresAt, resend = false }) {
  const url = buildVerificationUrl(rawToken);
  const heading = resend ? 'Here is your new confirmation link' : 'Confirm your email address';
  const expiryLine = expiresAt
    ? `This link expires on ${new Date(expiresAt).toUTCString()}.`
    : '';

  return deliver({
    to,
    kind: 'email_verification',
    subject: 'LuxRide — confirm your email address',
    text: [
      `${heading}.`,
      '',
      'Open the link below to confirm your email address and unlock your LuxRide account:',
      url,
      '',
      expiryLine,
      'If you did not create a LuxRide account, you can ignore this message.',
    ]
      .filter(Boolean)
      .join('\n'),
    html: [
      `<p>${heading}.</p>`,
      '<p>Open the link below to confirm your email address and unlock your LuxRide account:</p>',
      `<p><a href="${url}">Confirm my email address</a></p>`,
      expiryLine ? `<p>${expiryLine}</p>` : '',
      '<p>If you did not create a LuxRide account, you can ignore this message.</p>',
    ]
      .filter(Boolean)
      .join(''),
    context: { resend },
  });
}

async function sendReservationClaimEmail({ to, reservationId, rawToken, expiresAt }) {
  const url = buildClaimUrl(reservationId, rawToken);
  const expiryLine = expiresAt
    ? `This link expires on ${new Date(expiresAt).toUTCString()}.`
    : '';

  return deliver({
    to,
    kind: 'reservation_claim',
    subject: `LuxRide — add booking #${reservationId} to your account`,
    text: [
      `You can add booking #${reservationId} to a LuxRide account.`,
      '',
      'Log in (or sign up) with this email address, confirm your email address, then open:',
      url,
      '',
      expiryLine,
      'This link works once and only for this booking. If you did not request it, ignore this message.',
    ]
      .filter(Boolean)
      .join('\n'),
    html: [
      `<p>You can add booking #${reservationId} to a LuxRide account.</p>`,
      '<p>Log in (or sign up) with this email address, confirm your email address, then open:</p>',
      `<p><a href="${url}">Add this booking to my account</a></p>`,
      expiryLine ? `<p>${expiryLine}</p>` : '',
      '<p>This link works once and only for this booking. If you did not request it, ignore this message.</p>',
    ]
      .filter(Boolean)
      .join(''),
    context: { reservationId },
  });
}

async function sendReservationClaimedNotice({ to, reservationId }) {
  return deliver({
    to,
    kind: 'reservation_claimed',
    subject: `LuxRide — booking #${reservationId} was added to an account`,
    text: [
      `Booking #${reservationId} has been linked to the LuxRide account for this email address.`,
      '',
      'If this was not you, contact support immediately.',
    ].join('\n'),
    html: [
      `<p>Booking #${reservationId} has been linked to the LuxRide account for this email address.</p>`,
      '<p>If this was not you, contact support immediately.</p>',
    ].join(''),
    context: { reservationId },
  });
}

module.exports = {
  buildVerificationUrl,
  buildClaimUrl,
  sendEmailVerificationEmail,
  sendReservationClaimEmail,
  sendReservationClaimedNotice,
};
