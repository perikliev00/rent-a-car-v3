const { runWithTransaction } = require('../../db/transaction');
const userSql = require('../sql/userSqlService');
const tokenSql = require('../sql/emailVerificationTokenSqlService');
const { generateRawToken, hashToken, isPlausibleRawToken } = require('./tokenUtils');
const securityEmail = require('../email/securityEmailService');
const logEvent = require('../../monitoring/logEvent');
const logger = require('../../utils/logger');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const OUTCOMES = Object.freeze({
  VERIFIED: 'verified',
  ALREADY_VERIFIED: 'already_verified',
  INVALID: 'invalid',
  EXPIRED: 'expired',
  USED: 'used',
  REVOKED: 'revoked',
});

function expiryFromNow(now = Date.now()) {
  return new Date(now + TOKEN_TTL_MS);
}

/**
 * Issues a fresh verification token, revoking any outstanding one first so a resend
 * invalidates the previous link. Returns the raw token for mailing only — it is never
 * stored, logged, or returned to an API client.
 */
async function issueToken(user, client = null) {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = expiryFromNow();

  const persist = async (dbClient) => {
    await tokenSql.revokeActiveForUser(user.id, dbClient);
    return tokenSql.insertToken(
      { userId: user.id, tokenHash, expiresAt },
      dbClient
    );
  };

  const record = client ? await persist(client) : await runWithTransaction(persist);

  return { rawToken, expiresAt, tokenId: record?.id || null };
}

/**
 * Issues a token and mails it. Mail failures are swallowed by securityEmailService so a
 * transport problem never blocks or falsifies verification state.
 */
async function issueAndSendVerification(user, { resend = false } = {}) {
  if (!user?.id || !user?.email) {
    return { sent: false, reason: 'missing_user' };
  }

  if (user.emailVerified) {
    return { sent: false, reason: 'already_verified' };
  }

  const { rawToken, expiresAt } = await issueToken(user);

  const delivery = await securityEmail.sendEmailVerificationEmail({
    to: user.email,
    rawToken,
    expiresAt,
    resend,
  });

  logEvent.info('auth.email_verification.issued', {
    userId: user.id,
    resend,
    delivered: Boolean(delivery?.sent),
  });

  return { sent: Boolean(delivery?.sent), expiresAt };
}

/**
 * Consumes a verification token. Idempotent for the legitimate owner: replaying a link
 * for an account that is already verified reports success rather than an error.
 */
async function verifyToken(rawToken) {
  if (!isPlausibleRawToken(rawToken)) {
    return { outcome: OUTCOMES.INVALID };
  }

  const tokenHash = hashToken(rawToken);

  return runWithTransaction(async (client) => {
    const token = await tokenSql.findByTokenHashForUpdate(tokenHash, client);
    if (!token) {
      return { outcome: OUTCOMES.INVALID };
    }

    const user = await userSql.findUserById(token.userId, client);
    if (!user) {
      return { outcome: OUTCOMES.INVALID };
    }

    if (token.usedAt) {
      // A replayed link on an already-verified account is a no-op success, not a leak.
      return user.emailVerified
        ? { outcome: OUTCOMES.ALREADY_VERIFIED, user }
        : { outcome: OUTCOMES.USED };
    }

    if (token.revokedAt) {
      return user.emailVerified
        ? { outcome: OUTCOMES.ALREADY_VERIFIED, user }
        : { outcome: OUTCOMES.REVOKED };
    }

    if (new Date(token.expiresAt).getTime() <= Date.now()) {
      return user.emailVerified
        ? { outcome: OUTCOMES.ALREADY_VERIFIED, user }
        : { outcome: OUTCOMES.EXPIRED };
    }

    await tokenSql.markUsed(token.id, client);
    const verifiedUser = await userSql.markEmailVerified(token.userId, client);

    logEvent.info('auth.email_verification.completed', { userId: token.userId });

    return { outcome: OUTCOMES.VERIFIED, user: verifiedUser || user };
  });
}

/**
 * Resend with a per-account cooldown. Callers must not reveal the cooldown state to the
 * client beyond a generic response.
 */
async function resendVerification(user) {
  if (!user?.id) {
    return { status: 'ignored' };
  }

  if (user.emailVerified) {
    return { status: 'already_verified' };
  }

  const latest = await tokenSql.findLatestForUser(user.id);
  if (latest?.createdAt) {
    const age = Date.now() - new Date(latest.createdAt).getTime();
    if (age >= 0 && age < RESEND_COOLDOWN_MS) {
      logEvent.info('auth.email_verification.resend_throttled', { userId: user.id });
      return { status: 'throttled' };
    }
  }

  try {
    await issueAndSendVerification(user, { resend: true });
  } catch (err) {
    logger.warn({ err, userId: user.id }, 'Failed to resend verification email');
    return { status: 'error' };
  }

  return { status: 'sent' };
}

module.exports = {
  OUTCOMES,
  TOKEN_TTL_MS,
  RESEND_COOLDOWN_MS,
  issueToken,
  issueAndSendVerification,
  verifyToken,
  resendVerification,
};
