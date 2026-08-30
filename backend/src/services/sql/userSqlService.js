const { clientQuery, isUniqueViolation } = require('../../db/transaction');

const USER_SELECT = `
  u.id,
  u.email,
  u.password,
  u.role,
  u.email_verified_at,
  u.email_verification_token_hash,
  u.email_verification_expires_at,
  u.created_at,
  u.updated_at
`;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function mapSqlUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    email: row.email,
    password: row.password,
    role: row.role,
    emailVerifiedAt: row.email_verified_at || null,
    emailVerificationTokenHash: row.email_verification_token_hash || null,
    emailVerificationExpiresAt: row.email_verification_expires_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findUserByEmail(email, client = null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${USER_SELECT}
    FROM users u
    WHERE LOWER(u.email) = $1
    LIMIT 1
    `,
    [normalizedEmail]
  );

  return mapSqlUser(result.rows[0]) || null;
}

async function findUserById(userId, client = null) {
  const normalizedId = normalizeId(userId);
  if (!normalizedId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${USER_SELECT}
    FROM users u
    WHERE u.id = $1
    LIMIT 1
    `,
    [normalizedId]
  );

  return mapSqlUser(result.rows[0]) || null;
}

async function findUserByVerificationTokenHash(tokenHash, client = null) {
  const hash = String(tokenHash || '').trim();
  if (!hash) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${USER_SELECT}
    FROM users u
    WHERE u.email_verification_token_hash = $1
    LIMIT 1
    `,
    [hash]
  );

  return mapSqlUser(result.rows[0]) || null;
}

async function createUser(
  { email, password, role = 'user', emailVerifiedAt = null },
  client = null
) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required');
  }

  try {
    const result = await clientQuery(
      client,
      `
      INSERT INTO users (email, password, role, email_verified_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [normalizedEmail, password, role, emailVerifiedAt || null]
    );

    return mapSqlUser(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      const duplicateErr = new Error('Email is already in use');
      duplicateErr.code = 'EMAIL_IN_USE';
      throw duplicateErr;
    }
    throw err;
  }
}

async function setVerificationToken(userId, tokenHash, expiresAt, client = null) {
  const normalizedId = normalizeId(userId);
  if (!normalizedId || !tokenHash || !expiresAt) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    UPDATE users
    SET
      email_verification_token_hash = $2,
      email_verification_expires_at = $3,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [normalizedId, tokenHash, expiresAt]
  );

  return mapSqlUser(result.rows[0]) || null;
}

async function markEmailVerified(userId, client = null) {
  const normalizedId = normalizeId(userId);
  if (!normalizedId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    UPDATE users
    SET
      email_verified_at = COALESCE(email_verified_at, NOW()),
      email_verification_token_hash = NULL,
      email_verification_expires_at = NULL,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [normalizedId]
  );

  return mapSqlUser(result.rows[0]) || null;
}

async function clearVerificationToken(userId, client = null) {
  const normalizedId = normalizeId(userId);
  if (!normalizedId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    UPDATE users
    SET
      email_verification_token_hash = NULL,
      email_verification_expires_at = NULL,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [normalizedId]
  );

  return mapSqlUser(result.rows[0]) || null;
}

async function listUsers(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT ${USER_SELECT}
    FROM users u
    ORDER BY u.email ASC
    `
  );

  return result.rows.map(mapSqlUser);
}

module.exports = {
  mapSqlUser,
  findUserByEmail,
  findUserById,
  findUserByVerificationTokenHash,
  createUser,
  setVerificationToken,
  markEmailVerified,
  clearVerificationToken,
  listUsers,
};
