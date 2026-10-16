/**
 * Low-level SMTP mail sender via nodemailer.
 * When SMTP env is missing (or EMAIL_ENABLED=false), sendMail no-ops safely.
 */
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');
const metrics = require('../../monitoring/metrics');

/**
 * Explicit EMAIL_ENABLED override; null means "infer from SMTP env".
 * @returns {boolean|null}
 */
function isEmailEnabledFlag() {
  const flag = process.env.EMAIL_ENABLED;
  // Guard: early-return or throw when required input is missing/invalid.
  if (flag === undefined) {
    return null;
  }

  return ['true', '1', 'yes'].includes(String(flag).toLowerCase());
}

/**
 * Whether outbound email is configured and allowed.
 * @returns {boolean}
 */
function isEmailConfigured() {
  const enabledFlag = isEmailEnabledFlag();
  if (enabledFlag === false) {
    return false;
  }

  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_FROM
  );
}

/**
 * Insert transport and return the mapped result.
 * @returns {Promise<*>}
 */
async function createTransport() {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!isEmailConfigured()) {
    return null;
  }

  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send a single email; returns { sent: false } when SMTP is not configured.
 *
 * @param {{ to: string, subject: string, text?: string, html?: string }} params
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendMail({ to, subject, text, html }) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!to) {
    return { sent: false, reason: 'missing_recipient' };
  }

  const transport = await createTransport();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!transport) {
    logger.info({ to, subject }, 'Email skipped (SMTP not configured)');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  logEvent.info('email.confirmation.sent', { recipientType: 'direct' });

  return { sent: true };
}

module.exports = {
  isEmailConfigured,
  sendMail,
};
