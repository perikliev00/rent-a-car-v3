/**
 * Low-level SMTP mail sender via nodemailer.
 * When SMTP env is missing (or EMAIL_ENABLED=false), sendMail no-ops safely.
 */
const logger = require('../../utils/logger');
// Require the '../../monitoring/logEvent' module as logEvent.
const logEvent = require('../../monitoring/logEvent');
// Require the '../../monitoring/metrics' module as metrics.
const metrics = require('../../monitoring/metrics');

/**
 * Explicit EMAIL_ENABLED override; null means "infer from SMTP env".
 * @returns {boolean|null}
 */
function isEmailEnabledFlag() {
  // Create the flag constant.
  const flag = process.env.EMAIL_ENABLED;
  // Guard: early-return or throw when required input is missing/invalid.
  if (flag === undefined) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return ['true', '1', 'yes'].includes(String(flag).toLowerCase());
}

/**
 * Whether outbound email is configured and allowed.
 * @returns {boolean}
 */
function isEmailConfigured() {
  // Create the enabled flag constant.
  const enabledFlag = isEmailEnabledFlag();
  // Evaluate the condition and enter the branch when it is true.
  if (enabledFlag === false) {
    // Return the resulting value to the caller.
    return false;
  }

  // Return the resulting value to the caller.
  return Boolean(
    // Contribute this line to the enclosing declaration or statement.
    process.env.SMTP_HOST &&
      // Contribute this line to the enclosing declaration or statement.
      process.env.SMTP_USER &&
      // Contribute this line to the enclosing declaration or statement.
      process.env.SMTP_PASS &&
      // Contribute this line to the enclosing declaration or statement.
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
    // Return the resulting value to the caller.
    return null;
  }

  // Require the 'nodemailer' module as nodemailer.
  const nodemailer = require('nodemailer');
  // Create the port constant.
  const port = Number(process.env.SMTP_PORT || 587);

  // Return the resulting value to the caller.
  return nodemailer.createTransport({
    // Provide the host field value.
    host: process.env.SMTP_HOST,
    // Contribute this line to the enclosing declaration or statement.
    port,
    // Provide the secure field value.
    secure: port === 465,
    // Provide the auth field value.
    auth: {
      // Provide the user field value.
      user: process.env.SMTP_USER,
      // Provide the pass field value.
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
    // Return the resulting value to the caller.
    return { sent: false, reason: 'missing_recipient' };
  }

  // Create the transport constant.
  const transport = await createTransport();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!transport) {
    // Call logger.info to perform this step.
    logger.info({ to, subject }, 'Email skipped (SMTP not configured)');
    // Return the resulting value to the caller.
    return { sent: false, reason: 'smtp_not_configured' };
  }

  // Wait until the asynchronous operation resolves.
  await transport.sendMail({
    // Provide the from field value.
    from: process.env.MAIL_FROM,
    // Contribute this line to the enclosing declaration or statement.
    to,
    // Contribute this line to the enclosing declaration or statement.
    subject,
    // Contribute this line to the enclosing declaration or statement.
    text,
    // Contribute this line to the enclosing declaration or statement.
    html,
  });

  // Call logEvent.info to perform this step.
  logEvent.info('email.confirmation.sent', { recipientType: 'direct' });

  // Return the resulting value to the caller.
  return { sent: true };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  isEmailConfigured,
  // Contribute this line to the enclosing declaration or statement.
  sendMail,
};
