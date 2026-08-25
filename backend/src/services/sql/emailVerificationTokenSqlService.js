const { clientQuery } = require('../../db/transaction');

const TOKEN_SELECT = `
  id,
  user_id,
  expires_at,
  used_at,
  revoked_at,
  created_at
`;

function mapToken(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    userId: String(row.user_id),
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Invalidates every outstanding token for a user so only the newest one can be used. */
async function revokeActiveForUser(userId, client = null) {
  const uid = normalizeId(userId);
  if (!uid) {
    return 0;
  }

  const result = await clientQuery(
    client,
    `
    UPDATE email_verification_tokens
    SET revoked_at = NOW()
    WHERE user_id = $1
      AND used_at IS NULL
      AND revoked_at IS NULL
    `,
    [uid]
  );

  return result.rowCount || 0;
}

async function insertToken({ userId, tokenHash, expiresAt }, client = null) {
  const uid = normalizeId(userId);
  if (!uid || !tokenHash || !expiresAt) {
    throw new Error('userId, tokenHash and expiresAt are required');
  }

  const result = await clientQuery(
    client,
    `
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING ${TOKEN_SELECT}
    `,
    [uid, tokenHash, expiresAt]
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
    FROM email_verification_tokens
    WHERE token_hash = $1
    LIMIT 1
    `,
    [tokenHash]
  );

  return mapToken(result.rows[0]);
}

/** Locks the token row so two concurrent verifications cannot both consume it. */
async function findByTokenHashForUpdate(tokenHash, client) {
  if (!tokenHash) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${TOKEN_SELECT}
    FROM email_verification_tokens
    WHERE token_hash = $1
    FOR UPDATE
    `,
    [tokenHash]
  );

  return mapToken(result.rows[0]);
}

async function markUsed(tokenId, client = null) {
  const id = normalizeId(tokenId);
  if (!id) {
    return 0;
  }

  const result = await clientQuery(
    client,
    `
    UPDATE email_verification_tokens
    SET used_at = NOW()
    WHERE id = $1
      AND used_at IS NULL
      AND revoked_at IS NULL
    `,
    [id]
  );

  return result.rowCount || 0;
}

async function findLatestForUser(userId, client = null) {
  const uid = normalizeId(userId);
  if (!uid) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${TOKEN_SELECT}
    FROM email_verification_tokens
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    `,
    [uid]
  );

  return mapToken(result.rows[0]);
}

module.exports = {
  revokeActiveForUser,
  insertToken,
  findByTokenHash,
  findByTokenHashForUpdate,
  markUsed,
  findLatestForUser,
};
