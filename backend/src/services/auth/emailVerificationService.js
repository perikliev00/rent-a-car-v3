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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function emailHashFor(email) {
  return hashToken(normalizeEmail(email));
}

function expiryFromNow(now = Date.now()) {
  return new Date(now + TOKEN_TTL_MS);
}

function verificationIntegrityError(message) {
  const err = new Error(message);
  err.code = 'VERIFICATION_INTEGRITY_ERROR';
  err.status = 500;
  return err;
}

async function persistVerificationToken(user, { tokenHash, expiresAt }, dbClient) {
  const dbUser = await userSql.lockUserByIdForUpdate(user.id, dbClient);
  if (!dbUser) {
    throw verificationIntegrityError('Verification token issue: user row missing');
  }

  const emailHash = emailHashFor(dbUser.email);
  await tokenSql.revokeActiveForUser(dbUser.id, dbClient);
  return tokenSql.insertToken(
    { userId: dbUser.id, tokenHash, emailHash, expiresAt },
    dbClient
  );
}

/**
 * Issues a fresh verification token bound to the current DB email hash, revoking any
 * outstanding one first. Returns the raw token for mailing only — it is never stored,
 * logged, or returned to an API client.
 *
 * Caller must already hold the user row lock when passing a client, or this takes it.
 */
async function issueToken(user, client = null) {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = expiryFromNow();

  const persist = async (dbClient) =>
    persistVerificationToken(user, { tokenHash, expiresAt }, dbClient);

  const record = client ? await persist(client) : await runWithTransaction(persist);

  return { rawToken, expiresAt, tokenId: record?.id || null };
}

async function deliverVerificationEmail(user, { rawToken, expiresAt, resend }) {
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

  return delivery;
}

/**
 * Issues a token and mails it. A known resend/rotation delivery failure does not
 * revoke the last usable link.
 */
async function issueAndSendVerification(user, { resend = false } = {}) {
  if (!user?.id || !user?.email) {
    return { sent: false, reason: 'missing_user' };
  }

  if (user.emailVerified) {
    return { sent: false, reason: 'already_verified' };
  }

  const active = await tokenSql.findActiveForUser(user.id);
  const rotating = resend || Boolean(active);

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = expiryFromNow();

  if (rotating) {
    const delivery = await deliverVerificationEmail(user, {
      rawToken,
      expiresAt,
      resend: true,
    });
    if (!delivery?.sent) {
      return { sent: false, expiresAt };
    }

    await runWithTransaction(async (dbClient) =>
      persistVerificationToken(user, { tokenHash, expiresAt }, dbClient)
    );
    return { sent: true, expiresAt };
  }

  await runWithTransaction(async (dbClient) =>
    persistVerificationToken(user, { tokenHash, expiresAt }, dbClient)
  );

  const delivery = await deliverVerificationEmail(user, {
    rawToken,
    expiresAt,
    resend: false,
  });

  return { sent: Boolean(delivery?.sent), expiresAt };
}

function tokenEmailMatchesUser(token, user) {
  const expected = emailHashFor(user.email);
  return Boolean(token.emailHash) && token.emailHash === expected;
}

/**
 * Consumes a verification token. Idempotent for the legitimate owner: replaying a link
 * for an account that is already verified reports success rather than an error — but
 * only when the token is still bound to the current email.
 */
async function verifyToken(rawToken) {
  if (!isPlausibleRawToken(rawToken)) {
    return { outcome: OUTCOMES.INVALID };
  }

  const tokenHash = hashToken(rawToken);

  return runWithTransaction(async (client) => {
    const tokenPeek = await tokenSql.findByTokenHash(tokenHash, client);
    if (!tokenPeek) {
      return { outcome: OUTCOMES.INVALID };
    }

    const user = await userSql.lockUserByIdForUpdate(tokenPeek.userId, client);
    if (!user) {
      return { outcome: OUTCOMES.INVALID };
    }

    const token = await tokenSql.findByTokenHashForUpdate(tokenHash, client);
    if (!token) {
      return { outcome: OUTCOMES.INVALID };
    }

    if (!tokenEmailMatchesUser(token, user)) {
      return { outcome: OUTCOMES.INVALID };
    }

    if (token.usedAt) {
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

    const usedRows = await tokenSql.markUsed(token.id, client);
    if (usedRows !== 1) {
      throw verificationIntegrityError(
        'Verification refused: token consumption matched unexpected row count'
      );
    }

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
    const delivery = await issueAndSendVerification(user, { resend: true });
    if (!delivery?.sent) {
      return { status: 'error' };
    }
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
