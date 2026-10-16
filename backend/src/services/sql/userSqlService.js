/**
 * SQL for users table (find/create) used by admin staff management.
 */
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

/**
 * Normalize email before persistence or comparison.
 * @param {string} email
 * @returns {*}
 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Normalize id before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeId(value) {
  const id = Number(value);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

/**
 * Map a DB/API row into the domain shape used by callers (mapSqlUser).
 * @param {object} row
 * @returns {*}
 */
function mapSqlUser(row) {
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * Find user by email via SQL; returns null when missing.
 * @param {string} email
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findUserByEmail(email, client = null) {
  const normalizedEmail = normalizeEmail(email);
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * Find user by id via SQL; returns null when missing.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findUserById(userId, client = null) {
  const normalizedId = normalizeId(userId);
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * Find user by verification token hash via SQL; returns null when missing.
 * @param {string} tokenHash
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findUserByVerificationTokenHash(tokenHash, client = null) {
  const hash = String(tokenHash || '').trim();
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * Create a user; maps unique-email violations to EMAIL_IN_USE.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password - Already hashed password hash
 * @param {string} [params.role='user']
 * @param {*|null} [params.emailVerifiedAt]
 * @param {object|null} [client]
 * @returns {Promise<object>}
 * @throws {Error} EMAIL_IN_USE or validation errors
 */
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
    // Unique email index race → stable domain code for API mapping.
    if (isUniqueViolation(err)) {
      const duplicateErr = new Error('Email is already in use');
      duplicateErr.code = 'EMAIL_IN_USE';
      throw duplicateErr;
    }
    throw err;
  }
}

/**
 * set verification token — mutates persisted state when applicable.
 * @param {string|number} userId
 * @param {string} tokenHash
 * @param {*} expiresAt
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function setVerificationToken(userId, tokenHash, expiresAt, client = null) {
  const normalizedId = normalizeId(userId);
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * mark email verified — mutates persisted state when applicable.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function markEmailVerified(userId, client = null) {
  const normalizedId = normalizeId(userId);
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * clear verification token — mutates persisted state when applicable.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function clearVerificationToken(userId, client = null) {
  const normalizedId = normalizeId(userId);
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * List users from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
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
