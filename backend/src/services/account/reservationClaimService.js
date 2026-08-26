/**
 * Explicit, token-based linking of a guest reservation to an account.
 *
 * This is the only path by which reservations.user_id and orders.user_id may change after
 * booking. Knowing a booking email grants nothing; the caller must additionally hold a
 * single-use token that was mailed to that exact address, and their own account email
 * must be verified and equal to the booking email currently stored on the reservation.
 */

const { runWithTransaction } = require('../../db/transaction');
const reservationSql = require('../sql/reservationSqlService');
const orderSql = require('../sql/orderSqlService');
const userSql = require('../sql/userSqlService');
const claimTokenSql = require('../sql/reservationClaimTokenSqlService');
const auditSql = require('../sql/adminAuditSqlService');
const securityEmail = require('../email/securityEmailService');
const { generateRawToken, hashToken, isPlausibleRawToken } = require('../auth/tokenUtils');
const { isOrderRequiredForClaim } = require('../../domain/reservationStatus');
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

function sameUserId(left, right) {
  return left != null && right != null && String(left) === String(right);
}

function ownedByOther(ownerId, userId) {
  return ownerId != null && String(ownerId) !== String(userId);
}

function claimIntegrityError(message) {
  const err = new Error(message);
  err.code = 'CLAIM_INTEGRITY_ERROR';
  err.status = 500;
  return err;
}

function expiryFromNow(now = Date.now()) {
  return new Date(now + TOKEN_TTL_MS);
}

async function persistClaimTokenFromLockedReservation(reservation, dbClient) {
  const bookingEmail = normalizeEmail(reservation.email);
  if (!bookingEmail) {
    return null;
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = expiryFromNow();

  await claimTokenSql.revokeActiveForReservation(reservation.id, dbClient);
  const record = await claimTokenSql.insertToken(
    {
      reservationId: reservation.id,
      tokenHash,
      bookingEmail,
      expiresAt,
    },
    dbClient
  );

  return {
    rawToken,
    expiresAt,
    tokenId: record?.id || null,
    bookingEmail,
  };
}

/**
 * Issues a claim token bound to one reservation. The booking email is always taken from
 * the locked reservation row — callers cannot supply an authoritative address.
 * The raw token is returned for mailing only; the database keeps only its hash.
 */
async function issueClaimToken({ reservationId }, client = null) {
  const rid = Number(reservationId);
  if (!Number.isInteger(rid) || rid <= 0) {
    return null;
  }

  const persist = async (dbClient) => {
    const reservation = await reservationSql.lockOwnershipForClaim(rid, dbClient);
    if (!reservation) {
      return null;
    }
    return persistClaimTokenFromLockedReservation(reservation, dbClient);
  };

  return client ? persist(client) : runWithTransaction(persist);
}

async function deliverClaimEmail({ to, reservationId, rawToken, expiresAt }) {
  const delivery = await securityEmail.sendReservationClaimEmail({
    to,
    reservationId,
    rawToken,
    expiresAt,
  });

  logEvent.info('account.claim_token.issued', {
    reservationId: String(reservationId),
    delivered: Boolean(delivery?.sent),
  });

  return delivery;
}

/**
 * Issues a token and mails it to the current reservation email. Used after checkout,
 * by the self-service request endpoint, and after an admin changes the booking email.
 *
 * Rotating an existing usable token only persists after a known SMTP success so a
 * delivery failure cannot invalidate the last working link.
 */
async function issueAndSendClaimToken({ reservationId }) {
  const rid = Number(reservationId);
  if (!Number.isInteger(rid) || rid <= 0) {
    return { sent: false, reason: 'missing_input' };
  }

  const active = await claimTokenSql.findActiveForReservation(rid);
  if (active) {
    const preview = await reservationSql.findById(rid);
    const bookingEmail = normalizeEmail(preview?.email);
    if (!bookingEmail) {
      return { sent: false, reason: 'missing_input' };
    }

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = expiryFromNow();
    const delivery = await deliverClaimEmail({
      to: bookingEmail,
      reservationId: rid,
      rawToken,
      expiresAt,
    });
    if (!delivery?.sent) {
      return { sent: false };
    }

    await runWithTransaction(async (dbClient) => {
      const reservation = await reservationSql.lockOwnershipForClaim(rid, dbClient);
      if (!reservation || normalizeEmail(reservation.email) !== bookingEmail) {
        return null;
      }
      await claimTokenSql.revokeActiveForReservation(rid, dbClient);
      return claimTokenSql.insertToken(
        { reservationId: rid, tokenHash, bookingEmail, expiresAt },
        dbClient
      );
    });

    return { sent: true };
  }

  const issued = await issueClaimToken({ reservationId: rid });
  if (!issued) {
    return { sent: false, reason: 'missing_input' };
  }

  const delivery = await deliverClaimEmail({
    to: issued.bookingEmail,
    reservationId: rid,
    rawToken: issued.rawToken,
    expiresAt: issued.expiresAt,
  });

  return { sent: Boolean(delivery?.sent) };
}

/**
 * Called after the booking contact email on a reservation changes. Outstanding claim
 * tokens are revoked; an unclaimed reservation gets a fresh token mailed to the new
 * address, derived from the locked reservation row.
 */
async function onBookingEmailChanged(reservationId, client = null) {
  const rid = Number(reservationId);
  if (!Number.isInteger(rid) || rid <= 0) {
    return { sent: false, reason: 'missing_input' };
  }

  const work = async (dbClient) => {
    const reservation = await reservationSql.lockOwnershipForClaim(rid, dbClient);
    if (!reservation) {
      return { reservation: null, issued: null };
    }
    await claimTokenSql.revokeActiveForReservation(rid, dbClient);
    if (reservation.userId) {
      return { reservation, issued: null };
    }
    const issued = await persistClaimTokenFromLockedReservation(reservation, dbClient);
    return { reservation, issued };
  };

  const { issued } = client ? await work(client) : await runWithTransaction(work);
  if (!issued) {
    return { sent: false };
  }

  const delivery = await deliverClaimEmail({
    to: issued.bookingEmail,
    reservationId: rid,
    rawToken: issued.rawToken,
    expiresAt: issued.expiresAt,
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

function consistentlyOwnedBy(reservation, order, uid) {
  if (!sameUserId(reservation.userId, uid)) {
    return false;
  }
  if (!order) {
    return true;
  }
  return sameUserId(order.userId, uid);
}

/**
 * Consumes a claim token.
 *
 * Locking order inside the transaction (see transaction.js): non-locking token
 * lookup, then user, reservation, order (if present), then token FOR UPDATE.
 * Session email / emailVerified are ignored; the locked DB user is authoritative.
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

  const rid = Number(reservationId);
  if (!Number.isInteger(rid) || rid <= 0 || !isPlausibleRawToken(rawToken)) {
    return { outcome: OUTCOMES.INVALID_TOKEN };
  }

  const tokenHash = hashToken(rawToken);

  const result = await runWithTransaction(async (client) => {
    const tokenPeek = await claimTokenSql.findByTokenHash(tokenHash, client);
    if (!tokenPeek) {
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }
    if (String(tokenPeek.reservationId) !== String(rid)) {
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }

    const dbUser = await userSql.lockUserByIdForUpdate(uid, client);
    if (!dbUser) {
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }
    if (!dbUser.emailVerified) {
      return { outcome: OUTCOMES.EMAIL_MISMATCH };
    }
    const accountEmail = normalizeEmail(dbUser.email);
    if (!accountEmail) {
      return { outcome: OUTCOMES.EMAIL_MISMATCH };
    }

    const reservation = await reservationSql.lockOwnershipForClaim(rid, client);
    if (!reservation) {
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }

    const order = await orderSql.lockByReservationIdForUpdate(rid, client);

    const token = await claimTokenSql.findByTokenHashForUpdate(tokenHash, client);
    if (!token || String(token.reservationId) !== String(rid)) {
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }

    if (token.revokedAt) {
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }

    if (new Date(token.expiresAt).getTime() <= Date.now()) {
      return { outcome: OUTCOMES.EXPIRED };
    }

    const tokenEmail = normalizeEmail(token.bookingEmail);
    const reservationEmail = normalizeEmail(reservation.email);
    if (
      !tokenEmail ||
      tokenEmail !== accountEmail ||
      reservationEmail !== accountEmail
    ) {
      return { outcome: OUTCOMES.EMAIL_MISMATCH };
    }

    if (ownedByOther(reservation.userId, uid) || ownedByOther(order?.userId, uid)) {
      return { outcome: OUTCOMES.CONFLICT };
    }

    if (!order && isOrderRequiredForClaim(reservation.status)) {
      throw claimIntegrityError(
        'Claim refused: paid/confirmed reservation is missing its linked order'
      );
    }

    if (token.usedAt) {
      if (consistentlyOwnedBy(reservation, order, uid)) {
        return { outcome: OUTCOMES.ALREADY_OWNED, reservationId: rid };
      }
      if (
        reservation.userId &&
        order &&
        order.userId != null &&
        !sameUserId(reservation.userId, order.userId)
      ) {
        throw claimIntegrityError('Claim refused: reservation and order owners diverge');
      }
      return { outcome: OUTCOMES.INVALID_TOKEN };
    }

    const alreadyOwned = consistentlyOwnedBy(reservation, order, uid);

    const reservationRows = await reservationSql.assignOwnerIfUnclaimed(rid, uid, client);
    if (reservationRows !== 1) {
      throw claimIntegrityError(
        'Claim refused: reservation ownership update matched unexpected row count'
      );
    }

    if (order) {
      const orderRows = await orderSql.assignOwnerByReservationIdIfUnclaimed(rid, uid, client);
      if (orderRows !== 1) {
        throw claimIntegrityError(
          'Claim refused: order ownership update matched unexpected row count'
        );
      }
    }

    const usedRows = await claimTokenSql.markUsed(token.id, uid, client);
    if (usedRows !== 1) {
      throw claimIntegrityError('Claim refused: claim token consumption matched unexpected row count');
    }

    return {
      outcome: alreadyOwned ? OUTCOMES.ALREADY_OWNED : OUTCOMES.CLAIMED,
      reservationId: rid,
      accountEmail,
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
      .sendReservationClaimedNotice({
        to: result.accountEmail,
        reservationId: rid,
      })
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
 * The caller must be verified in the database, and a token is only ever mailed to the
 * email stored on the booking itself. The response is intentionally uniform so this
 * cannot be used to test whether a reservation id or email exists.
 */
async function requestClaimToken({ user, reservationId, bookingEmail }) {
  const rid = Number(reservationId);
  const uid = Number(user?.id);
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(rid) || rid <= 0) {
    return { status: 'ignored' };
  }

  const dbUser = await userSql.findUserById(uid);
  if (!dbUser?.emailVerified) {
    return { status: 'ignored' };
  }

  const accountEmail = normalizeEmail(dbUser.email);
  const requestedEmail = normalizeEmail(bookingEmail);

  // Requesting a link for an address other than your own verified address is pointless
  // (the claim would be refused anyway), so refuse before touching the reservation.
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

  if (reservation.userId && String(reservation.userId) !== String(dbUser.id)) {
    return { status: 'ignored' };
  }

  try {
    await issueAndSendClaimToken({ reservationId: rid });
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
  onBookingEmailChanged,
  claimReservation,
  requestClaimToken,
};
