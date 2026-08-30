const crypto = require('crypto');
const userSql = require('../sql/userSqlService');
const { sendMail } = require('../email/emailService');
const { claimReservationsForUser } = require('../account/accountClaimService');
const { config } = require('../../config/env');
const logger = require('../../utils/logger');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function createHttpError(code, message, status) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function hashEmailVerificationToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function hashesEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function buildVerifyUrl(token) {
  const base = String(config.frontendBaseUrl || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

async function issueAndSendVerificationEmail(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashEmailVerificationToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await userSql.setVerificationToken(user.id, tokenHash, expiresAt);

  const verifyUrl = buildVerifyUrl(token);
  const result = await sendMail({
    to: user.email,
    subject: 'Verify your LuxRide email',
    text: [
      'Confirm this email address to link guest bookings to your account.',
      '',
      verifyUrl,
      '',
      'If you did not create this account, ignore this email. The link expires in 24 hours.',
    ].join('\n'),
    html: [
      '<p>Confirm this email address to link guest bookings to your account.</p>',
      `<p><a href="${verifyUrl}">Verify email</a></p>`,
      '<p>If you did not create this account, ignore this email. The link expires in 24 hours.</p>',
    ].join(''),
  });

  if (!result.sent && !config.isProd) {
    logger.info({ userId: user.id, verifyUrl }, 'Email verification link (SMTP not configured)');
  }

  return { sent: Boolean(result.sent), expiresAt };
}

async function sendVerificationEmail(user) {
  if (!user?.id || !user.email) {
    throw createHttpError('VALIDATION_ERROR', 'A user email is required.', 422);
  }
  if (user.emailVerifiedAt) {
    throw createHttpError('EMAIL_ALREADY_VERIFIED', 'Email is already verified.', 409);
  }

  return issueAndSendVerificationEmail(user);
}

async function resendVerificationEmail(userId) {
  const user = await userSql.findUserById(userId);
  if (!user) {
    throw createHttpError('UNAUTHORIZED', 'You are not logged in.', 401);
  }
  if (user.emailVerifiedAt) {
    throw createHttpError('EMAIL_ALREADY_VERIFIED', 'Email is already verified.', 409);
  }

  return issueAndSendVerificationEmail(user);
}

async function verifyEmailToken(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token) {
    throw createHttpError('INVALID_TOKEN', 'This verification link is invalid or has expired.', 400);
  }

  const tokenHash = hashEmailVerificationToken(token);
  const user = await userSql.findUserByVerificationTokenHash(tokenHash);
  if (!user || !hashesEqual(user.emailVerificationTokenHash, tokenHash)) {
    throw createHttpError('INVALID_TOKEN', 'This verification link is invalid or has expired.', 400);
  }

  const expiresAt = user.emailVerificationExpiresAt
    ? new Date(user.emailVerificationExpiresAt).getTime()
    : 0;
  if (!expiresAt || expiresAt <= Date.now()) {
    await userSql.clearVerificationToken(user.id);
    throw createHttpError('TOKEN_EXPIRED', 'This verification link is invalid or has expired.', 400);
  }

  const verified = await userSql.markEmailVerified(user.id);
  try {
    await claimReservationsForUser(verified.id, verified.email);
  } catch (claimErr) {
    logger.warn({ err: claimErr, userId: verified.id }, 'Failed to claim reservations on email verify');
  }

  return verified;
}

module.exports = {
  TOKEN_TTL_MS,
  hashEmailVerificationToken,
  sendVerificationEmail,
  resendVerificationEmail,
  verifyEmailToken,
};
