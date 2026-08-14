const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');
const metrics = require('../../monitoring/metrics');

function isEmailEnabledFlag() {
  const flag = process.env.EMAIL_ENABLED;
  if (flag === undefined) {
    return null;
  }

  return ['true', '1', 'yes'].includes(String(flag).toLowerCase());
}

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

async function createTransport() {
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

async function sendMail({ to, subject, text, html }) {
  if (!to) {
    return { sent: false, reason: 'missing_recipient' };
  }

  const transport = await createTransport();
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
