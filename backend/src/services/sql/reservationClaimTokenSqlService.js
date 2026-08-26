const { clientQuery } = require('../../db/transaction');

const TOKEN_SELECT = `
  id,
  reservation_id,
  booking_email,
  expires_at,
  used_at,
  revoked_at,
  used_by_user_id,
  created_at
`;

function mapToken(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    reservationId: String(row.reservation_id),
    bookingEmail: row.booking_email,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
    usedByUserId: row.used_by_user_id != null ? String(row.used_by_user_id) : null,
    createdAt: row.created_at,
  };
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Rotation: outstanding tokens for a reservation are killed before a new one is issued. */
async function revokeActiveForReservation(reservationId, client = null) {
  const rid = normalizeId(reservationId);
  if (!rid) {
    return 0;
  }

  const result = await clientQuery(
    client,
    `
    UPDATE reservation_claim_tokens
    SET revoked_at = NOW()
    WHERE reservation_id = $1
      AND used_at IS NULL
      AND revoked_at IS NULL
    `,
    [rid]
  );

  return result.rowCount || 0;
}

async function insertToken(
  { reservationId, tokenHash, bookingEmail, expiresAt },
  client = null
) {
  const rid = normalizeId(reservationId);
  const normalizedEmail = normalizeEmail(bookingEmail);
  if (!rid || !tokenHash || !normalizedEmail || !expiresAt) {
    throw new Error('reservationId, tokenHash, bookingEmail and expiresAt are required');
  }

  const result = await clientQuery(
    client,
    `
    INSERT INTO reservation_claim_tokens
      (reservation_id, token_hash, booking_email, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING ${TOKEN_SELECT}
    `,
    [rid, tokenHash, normalizedEmail, expiresAt]
  );

  return mapToken(result.rows[0]);
}

async function findByTokenHash(tokenHash, client = null) {
  if (!tokenHash) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${TOKEN_SELECT}
    FROM reservation_claim_tokens
    WHERE token_hash = $1
    LIMIT 1
    `,
    [tokenHash]
  );

  return mapToken(result.rows[0]);
}

/**
 * Locks the claim token row. Taken last on the claim path, after user / reservation /
 * order locks (see transaction.js security-token lock order).
 */
async function findByTokenHashForUpdate(tokenHash, client) {
  if (!tokenHash) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${TOKEN_SELECT}
    FROM reservation_claim_tokens
    WHERE token_hash = $1
    FOR UPDATE
    `,
    [tokenHash]
  );

  return mapToken(result.rows[0]);
}

async function markUsed(tokenId, userId, client = null) {
  const id = normalizeId(tokenId);
  const uid = normalizeId(userId);
  if (!id || !uid) {
    return 0;
  }

  const result = await clientQuery(
    client,
    `
    UPDATE reservation_claim_tokens
    SET used_at = NOW(), used_by_user_id = $2
    WHERE id = $1
      AND used_at IS NULL
      AND revoked_at IS NULL
    `,
    [id, uid]
  );

  return result.rowCount || 0;
}

async function findLatestForReservation(reservationId, client = null) {
  const rid = normalizeId(reservationId);
  if (!rid) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${TOKEN_SELECT}
    FROM reservation_claim_tokens
    WHERE reservation_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    `,
    [rid]
  );

  return mapToken(result.rows[0]);
}

async function findActiveForReservation(reservationId, client = null) {
  const rid = normalizeId(reservationId);
  if (!rid) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${TOKEN_SELECT}
    FROM reservation_claim_tokens
    WHERE reservation_id = $1
      AND used_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    `,
    [rid]
  );

  return mapToken(result.rows[0]);
}

module.exports = {
  revokeActiveForReservation,
  insertToken,
  findByTokenHash,
  findByTokenHashForUpdate,
  markUsed,
  findLatestForReservation,
  findActiveForReservation,
};
