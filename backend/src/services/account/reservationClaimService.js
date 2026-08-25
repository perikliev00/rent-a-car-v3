/**
 * Explicit, token-based linking of a guest reservation to an account.
 *
 * This is the only path by which reservations.user_id and orders.user_id may change after
 * booking. Knowing a booking email grants nothing; the caller must additionally hold a
 * single-use token that was mailed to that exact address, and their own account email
 * must be verified and equal to the booking email.
 */

const { runWithTransaction } = require('../../db/transaction');
const reservationSql = require('../sql/reservationSqlService');
const orderSql = require('../sql/orderSqlService');
const claimTokenSql = require('../sql/reservationClaimTokenSqlService');
const auditSql = require('../sql/adminAuditSqlService');
const securityEmail = require('../email/securityEmailService');
const { generateRawToken, hashToken, isPlausibleRawToken } = require('../auth/tokenUtils');
const logEvent = require('../../monitoring/logEvent');
const logger = require('../../utils/logger');

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const OUTCOMES = Object.freeze({
  CLAIMED: 'claimed',
  ALREADY_OWNED: 'already_owned',
  INVALID_TOKEN: 'invalid_token',
  EXPIRED: 'expired',
  EMAIL_MISMATCH: 'email_mismatch',
  CONFLICT: 'conflict',
});

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Issues a claim token bound to one reservation and its booking email, revoking any
 * outstanding token for that reservation first. The raw token is returned for mailing
 * only; the database keeps only its hash.
 */
async function issueClaimToken({ reservationId, bookingEmail }, client = null) {
  const normalizedEmail = normalizeEmail(bookingEmail);
  if (!reservationId || !normalizedEmail) {
    return null;
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const persist = async (dbClient) => {
    await claimTokenSql.revokeActiveForReservation(reservationId, dbClient);
    return claimTokenSql.insertToken(
      { reservationId, tokenHash, bookingEmail: normalizedEmail, expiresAt },
      dbClient
    );
  };

  const record = client ? await persist(client) : await runWithTransaction(persist);

  return { rawToken, expiresAt, tokenId: record?.id || null, bookingEmail: normalizedEmail };
}

/**
 * Issues a token and mails it to the booking email. Used after checkout and by the
 * self-service request endpoint for legacy bookings.
 */
async function issueAndSendClaimToken({ reservationId, bookingEmail }) {
  const issued = await issueClaimToken({ reservationId, bookingEmail });
  if (!issued) {
    return { sent: false, reason: 'missing_input' };
  }

  const delivery = await securityEmail.sendReservationClaimEmail({
    to: issued.bookingEmail,
    reservationId,
    rawToken: issued.rawToken,
    expiresAt: issued.expiresAt,
  });

  logEvent.info('account.claim_token.issued', {
    reservationId: String(reservationId),
    delivered: Boolean(delivery?.sent),
  });

  return { sent: Boolean(delivery?.sent) };
}

async function recordAudit({ action, userId, reservationId, outcome, ipAddress }) {
  try {
    await auditSql.insertAuditLog({
      adminUserId: userId,
      actorType: 'customer',
      action,
      entityType: 'reservation',
      entityId: reservationId != null ? String(reservationId) : null,
      // Deliberately no raw token and no booking PII.
      metadata: { outcome },
      ipAddress: ipAddress || null,
    });
  } catch (err) {
    logger.warn({ err, action }, 'Failed to write claim audit log');
  }
}

/**
 * Consumes a claim token.
 *
 * Locking order inside the transaction: claim token row, then reservation row. Two
 * parallel claims therefore serialize on the token (same token) or on the reservation
 * (different tokens), and the conditional UPDATE makes the loser fail closed.
 */
async function claimReservation({
  user,
  reservationId,
  rawToken,
  ipAddress = null,
}) {
  const uid = Number(user?.id);
  if (!Number.isInteger(uid) || uid <= 0) {
    return { outcome: OUTCOMES.INVALID_TOKEN };
  }

  // Ownership of historical bookings requires a verified account email; an unverified
  // session must never be able to attach someone else's booking.
  if (!user.emailVerified) {
    return { outcome: OUTCOMES.EMAIL_MISMATCH };
  }

  const accountEmail = normalizeEmail(user.email);
  if (!accountEmail) {
    return { outcome: OUTCOMES.EMAIL_MISMATCH };
  }

  const rid = Number(reservationId);
  if (!Number.isInteger(rid) || rid <= 0 || !isPlausibleRawToken(rawToken)) {
    return { outcome: OUTCOMES.INVALID_TOKEN };
  }

  const tokenHash = hashToken(rawToken);

  const result = await runWithTransaction(async (client) => {
    const token = await claimTokenSql.findByTokenHashForUpdate(tokenHash, client);
    if (!token) {
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }

    // A token is bound to exactly one reservation; it cannot be replayed against another.
    if (String(token.reservationId) !== String(rid)) {
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }

    if (token.revokedAt) {
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }

    if (new Date(token.expiresAt).getTime() <= Date.now()) {
      return { outcome: OUTCOMES.EXPIRED };
    }

    if (normalizeEmail(token.bookingEmail) !== accountEmail) {
      return { outcome: OUTCOMES.EMAIL_MISMATCH };
    }

    const reservation = await reservationSql.lockOwnershipForClaim(rid, client);
    if (!reservation) {
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }

    if (reservation.userId && String(reservation.userId) !== String(uid)) {
      // Another account already owns this booking. Never transfer ownership.
      return { outcome: OUTCOMES.CONFLICT };
    }

    if (token.usedAt) {
      // Idempotent replay by the rightful owner; a used token in anyone else's hands is
      // already covered by the ownership check above.
      return String(reservation.userId) === String(uid)
        ? { outcome: OUTCOMES.ALREADY_OWNED, reservationId: rid }
        : { outcome: OUTCOMES.INVALID_TOKEN };
    }

    const alreadyOwned = String(reservation.userId) === String(uid);

    const reservationRows = await reservationSql.assignOwnerIfUnclaimed(rid, uid, client);
    if (reservationRows === 0) {
      return { outcome: OUTCOMES.CONFLICT };
    }

    // The linked order moves in the same transaction, so a failure can never leave only
    // one of the two rows claimed.
    await orderSql.assignOwnerByReservationIdIfUnclaimed(rid, uid, client);
    await claimTokenSql.markUsed(token.id, uid, client);

    return {
      outcome: alreadyOwned ? OUTCOMES.ALREADY_OWNED : OUTCOMES.CLAIMED,
      reservationId: rid,
    };
  });

  await recordAudit({
    action: 'account.reservation.claim',
    userId: uid,
    reservationId: rid,
    outcome: result.outcome,
    ipAddress,
  });

  if (result.outcome === OUTCOMES.CLAIMED) {
    logEvent.info('account.reservation.claimed', {
      userId: String(uid),
      reservationId: String(rid),
    });

    // Best-effort security notice; delivery never affects the committed claim.
    await securityEmail
      .sendReservationClaimedNotice({ to: accountEmail, reservationId: rid })
      .catch(() => {});
  } else {
    logEvent.warn('account.reservation.claim_rejected', {
      userId: String(uid),
      reservationId: String(rid),
      outcome: result.outcome,
    });
  }

  return result;
}

/**
 * Self-service recovery for legacy guest bookings that predate claim tokens.
 *
 * The caller must be verified, and a token is only ever mailed to the email stored on the
 * booking itself. The response is intentionally uniform so this cannot be used to test
 * whether a reservation id or email exists.
 */
async function requestClaimToken({ user, reservationId, bookingEmail }) {
  const rid = Number(reservationId);
  if (!user?.emailVerified || !Number.isInteger(rid) || rid <= 0) {
    return { status: 'ignored' };
  }

  const accountEmail = normalizeEmail(user.email);
  const requestedEmail = normalizeEmail(bookingEmail);

  // Requesting a link for an address other than your own verified address is pointless
  // (the claim would be refused anyway), so refuse before touching the database.
  if (!accountEmail || accountEmail !== requestedEmail) {
    return { status: 'ignored' };
  }

  const reservation = await reservationSql.findById(rid);
  if (!reservation) {
    return { status: 'ignored' };
  }

  if (normalizeEmail(reservation.email) !== accountEmail) {
    return { status: 'ignored' };
  }

  if (reservation.userId && String(reservation.userId) !== String(user.id)) {
    return { status: 'ignored' };
  }

  try {
    await issueAndSendClaimToken({ reservationId: rid, bookingEmail: accountEmail });
  } catch (err) {
    logger.warn({ err, reservationId: rid }, 'Failed to issue claim token on request');
    return { status: 'error' };
  }

  return { status: 'sent' };
}

module.exports = {
  OUTCOMES,
  TOKEN_TTL_MS,
  issueClaimToken,
  issueAndSendClaimToken,
  claimReservation,
  requestClaimToken,
};
