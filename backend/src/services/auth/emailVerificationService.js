/**
 * Email verification tokens for customer accounts.
 * Stores only SHA-256 hashes of tokens; on verify, claims guest reservations by email.
 */
const crypto = require('crypto');
// Require the '../sql/userSqlService' module as userSql.
const userSql = require('../sql/userSqlService');
// Destructure object properties into local variables.
const { sendMail } = require('../email/emailService');
// Destructure object properties into local variables.
const { claimReservationsForUser } = require('../account/accountClaimService');
// Destructure object properties into local variables.
const { config } = require('../../config/env');
// Require the '../../utils/logger' module as logger.
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
  // Create the err constant.
  const err = new Error(message);
  // Update err.code with the right-hand side value.
  err.code = code;
  // Update err.status with the right-hand side value.
  err.status = status;
  // Return the resulting value to the caller.
  return err;
}

/**
 * Hash a raw verification token for storage (never store plaintext tokens).
 * @param {string} token
 * @returns {string} hex SHA-256 digest
 */
function hashEmailVerificationToken(token) {
  // Return the resulting value to the caller.
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

/** Constant-time string compare to avoid timing leaks on token hashes. */
function hashesEqual(left, right) {
  // Create the a constant.
  const a = Buffer.from(String(left || ''), 'utf8');
  // Create the b constant.
  const b = Buffer.from(String(right || ''), 'utf8');
  // Evaluate the condition and enter the branch when it is true.
  if (a.length !== b.length) {
    // Return the resulting value to the caller.
    return false;
  }
  // Return the resulting value to the caller.
  return crypto.timingSafeEqual(a, b);
}

/**
 * Transform helper: build verify url.
 * @param {string} token
 * @returns {*}
 */
function buildVerifyUrl(token) {
  // Create the base constant.
  const base = String(config.frontendBaseUrl || 'http://localhost:5173').replace(/\/+$/, '');
  // Return the resulting value to the caller.
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

/**
 * Issue a new token, persist its hash, and email the verify link.
 * @param {object} user
 * @returns {Promise<{ sent: boolean, expiresAt: Date }>}
 */
async function issueAndSendVerificationEmail(user) {
  // Create the token constant.
  const token = crypto.randomBytes(32).toString('hex');
  // Create the token hash constant.
  const tokenHash = hashEmailVerificationToken(token);
  // Create the expires at constant.
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  // Wait until the asynchronous operation resolves.
  await userSql.setVerificationToken(user.id, tokenHash, expiresAt);

  // Create the verify url constant.
  const verifyUrl = buildVerifyUrl(token);
  // Create the result constant.
  const result = await sendMail({
    // Provide the to field value.
    to: user.email,
    // Provide the subject field value.
    subject: 'Verify your LuxRide email',
    // Provide the text field value.
    text: [
      // Supply the literal value used by the enclosing expression.
      'Confirm this email address to link guest bookings to your account.',
      // Supply the literal value used by the enclosing expression.
      '',
      // Contribute this line to the enclosing declaration or statement.
      verifyUrl,
      // Supply the literal value used by the enclosing expression.
      '',
      // Supply the literal value used by the enclosing expression.
      'If you did not create this account, ignore this email. The link expires in 24 hours.',
    // Continue the surrounding logic with this statement.
    ].join('\n'),
    // Provide the html field value.
    html: [
      // Continue the surrounding logic with this statement.
      '<p>Confirm this email address to link guest bookings to your account.</p>',
      // Continue the surrounding logic with this statement.
      `<p><a href="${verifyUrl}">Verify email</a></p>`,
      // Continue the surrounding logic with this statement.
      '<p>If you did not create this account, ignore this email. The link expires in 24 hours.</p>',
    // Continue the surrounding logic with this statement.
    ].join(''),
  });

  // Dev convenience: log the link when SMTP is not configured.
  if (!result.sent && !config.isProd) {
    // Call logger.info to perform this step.
    logger.info({ userId: user.id, verifyUrl }, 'Email verification link (SMTP not configured)');
  }

  // Return the resulting value to the caller.
  return { sent: Boolean(result.sent), expiresAt };
}

/**
 * Send verification email for a user who is not yet verified.
 * @param {object} user
 */
async function sendVerificationEmail(user) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!user?.id || !user.email) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'A user email is required.', 422);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (user.emailVerifiedAt) {
    // Throw an error to stop the current control flow.
    throw createHttpError('EMAIL_ALREADY_VERIFIED', 'Email is already verified.', 409);
  }

  // Return the resulting value to the caller.
  return issueAndSendVerificationEmail(user);
}

/**
 * Resend verification for the logged-in user id.
 * @param {string|number} userId
 */
async function resendVerificationEmail(userId) {
  // Create the user constant.
  const user = await userSql.findUserById(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!user) {
    // Throw an error to stop the current control flow.
    throw createHttpError('UNAUTHORIZED', 'You are not logged in.', 401);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (user.emailVerifiedAt) {
    // Throw an error to stop the current control flow.
    throw createHttpError('EMAIL_ALREADY_VERIFIED', 'Email is already verified.', 409);
  }

  // Return the resulting value to the caller.
  return issueAndSendVerificationEmail(user);
}

/**
 * Consume a verification token, mark email verified, and claim guest bookings.
 * @param {string} rawToken
 * @returns {Promise<object>} Verified user row
 */
async function verifyEmailToken(rawToken) {
  // Create the token constant.
  const token = String(rawToken || '').trim();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!token) {
    // Throw an error to stop the current control flow.
    throw createHttpError('INVALID_TOKEN', 'This verification link is invalid or has expired.', 400);
  }

  // Create the token hash constant.
  const tokenHash = hashEmailVerificationToken(token);
  // Create the user constant.
  const user = await userSql.findUserByVerificationTokenHash(tokenHash);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!user || !hashesEqual(user.emailVerificationTokenHash, tokenHash)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('INVALID_TOKEN', 'This verification link is invalid or has expired.', 400);
  }

  // Create the expires at constant.
  const expiresAt = user.emailVerificationExpiresAt
    // Continue the surrounding logic with this statement.
    ? new Date(user.emailVerificationExpiresAt).getTime()
    // Contribute this line to the enclosing declaration or statement.
    : 0;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!expiresAt || expiresAt <= Date.now()) {
    // Wait until the asynchronous operation resolves.
    await userSql.clearVerificationToken(user.id);
    // Throw an error to stop the current control flow.
    throw createHttpError('TOKEN_EXPIRED', 'This verification link is invalid or has expired.', 400);
  }

  // Create the verified constant.
  const verified = await userSql.markEmailVerified(user.id);
  // Protected block: isolate failure modes.
  try {
    // Link prior guest reservations that used this email.
    await claimReservationsForUser(verified.id, verified.email);
  // Continue the surrounding logic with this statement.
  } catch (claimErr) {
    // Call logger.warn to perform this step.
    logger.warn({ err: claimErr, userId: verified.id }, 'Failed to claim reservations on email verify');
  }

  // Return the resulting value to the caller.
  return verified;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  TOKEN_TTL_MS,
  // Contribute this line to the enclosing declaration or statement.
  hashEmailVerificationToken,
  // Contribute this line to the enclosing declaration or statement.
  sendVerificationEmail,
  // Contribute this line to the enclosing declaration or statement.
  resendVerificationEmail,
  // Contribute this line to the enclosing declaration or statement.
  verifyEmailToken,
};
