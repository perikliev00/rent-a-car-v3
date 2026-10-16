/**
 * Email verification tokens for customer accounts.
 * Stores only SHA-256 hashes of tokens; on verify, claims guest reservations by email.
 */
const crypto = require('crypto');
const userSql = require('../sql/userSqlService');
const { sendMail } = require('../email/emailService');
const { claimReservationsForUser } = require('../account/accountClaimService');
const { config } = require('../../config/env');
const logger = require('../../utils/logger');

/** Verification link lifetime (24 hours). */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Insert http error and return the mapped result.
 * @param {*} code
 * @param {string} message
 * @param {string} status
 * @returns {*}
 */
function createHttpError(code, message, status) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

/**
 * Hash a raw verification token for storage (never store plaintext tokens).
 * @param {string} token
 * @returns {string} hex SHA-256 digest
 */
function hashEmailVerificationToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

/** Constant-time string compare to avoid timing leaks on token hashes. */
function hashesEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * Transform helper: build verify url.
 * @param {string} token
 * @returns {*}
 */
function buildVerifyUrl(token) {
  const base = String(config.frontendBaseUrl || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

/**
 * Issue a new token, persist its hash, and email the verify link.
 * @param {object} user
 * @returns {Promise<{ sent: boolean, expiresAt: Date }>}
 */
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

  // Dev convenience: log the link when SMTP is not configured.
  if (!result.sent && !config.isProd) {
    logger.info({ userId: user.id, verifyUrl }, 'Email verification link (SMTP not configured)');
  }

  return { sent: Boolean(result.sent), expiresAt };
}

/**
 * Send verification email for a user who is not yet verified.
 * @param {object} user
 */
async function sendVerificationEmail(user) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!user?.id || !user.email) {
    throw createHttpError('VALIDATION_ERROR', 'A user email is required.', 422);
  }
  if (user.emailVerifiedAt) {
    throw createHttpError('EMAIL_ALREADY_VERIFIED', 'Email is already verified.', 409);
  }

  return issueAndSendVerificationEmail(user);
}

/**
 * Resend verification for the logged-in user id.
 * @param {string|number} userId
 */
async function resendVerificationEmail(userId) {
  const user = await userSql.findUserById(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!user) {
    throw createHttpError('UNAUTHORIZED', 'You are not logged in.', 401);
  }
  if (user.emailVerifiedAt) {
    throw createHttpError('EMAIL_ALREADY_VERIFIED', 'Email is already verified.', 409);
  }

  return issueAndSendVerificationEmail(user);
}

/**
 * Consume a verification token, mark email verified, and claim guest bookings.
 * @param {string} rawToken
 * @returns {Promise<object>} Verified user row
 */
async function verifyEmailToken(rawToken) {
  const token = String(rawToken || '').trim();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!token) {
    throw createHttpError('INVALID_TOKEN', 'This verification link is invalid or has expired.', 400);
  }

  const tokenHash = hashEmailVerificationToken(token);
  const user = await userSql.findUserByVerificationTokenHash(tokenHash);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!user || !hashesEqual(user.emailVerificationTokenHash, tokenHash)) {
    throw createHttpError('INVALID_TOKEN', 'This verification link is invalid or has expired.', 400);
  }

  const expiresAt = user.emailVerificationExpiresAt
    ? new Date(user.emailVerificationExpiresAt).getTime()
    : 0;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!expiresAt || expiresAt <= Date.now()) {
    await userSql.clearVerificationToken(user.id);
    throw createHttpError('TOKEN_EXPIRED', 'This verification link is invalid or has expired.', 400);
  }

  const verified = await userSql.markEmailVerified(user.id);
  // Protected block: isolate failure modes.
  try {
    // Link prior guest reservations that used this email.
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
