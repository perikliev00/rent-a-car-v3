/**
 * SQL for users table (find/create) used by admin staff management.
 */
const { clientQuery, isUniqueViolation } = require('../../db/transaction');

// Create the user select constant.
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
  // Return the resulting value to the caller.
  return String(email || '').trim().toLowerCase();
}

/**
 * Normalize id before persistence or comparison.
 * @param {*} value
 * @returns {*}
 */
function normalizeId(value) {
  // Create the id constant.
  const id = Number(value);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the email field value.
    email: row.email,
    // Provide the password field value.
    password: row.password,
    // Provide the role field value.
    role: row.role,
    // Provide the email verified at field value.
    emailVerifiedAt: row.email_verified_at || null,
    // Provide the email verification token hash field value.
    emailVerificationTokenHash: row.email_verification_token_hash || null,
    // Provide the email verification expires at field value.
    emailVerificationExpiresAt: row.email_verification_expires_at || null,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
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
  // Create the normalized email constant.
  const normalizedEmail = normalizeEmail(email);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedEmail) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${USER_SELECT}
    FROM users u
    WHERE LOWER(u.email) = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedEmail]
  );

  // Return the resulting value to the caller.
  return mapSqlUser(result.rows[0]) || null;
}

/**
 * Find user by id via SQL; returns null when missing.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findUserById(userId, client = null) {
  // Create the normalized id constant.
  const normalizedId = normalizeId(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${USER_SELECT}
    FROM users u
    WHERE u.id = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedId]
  );

  // Return the resulting value to the caller.
  return mapSqlUser(result.rows[0]) || null;
}

/**
 * Find user by verification token hash via SQL; returns null when missing.
 * @param {string} tokenHash
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function findUserByVerificationTokenHash(tokenHash, client = null) {
  // Create the hash constant.
  const hash = String(tokenHash || '').trim();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!hash) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${USER_SELECT}
    FROM users u
    WHERE u.email_verification_token_hash = $1
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [hash]
  );

  // Return the resulting value to the caller.
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
  // Continue the surrounding logic with this statement.
  { email, password, role = 'user', emailVerifiedAt = null },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the normalized email constant.
  const normalizedEmail = normalizeEmail(email);
  // Evaluate the condition and enter the branch when it is true.
  if (!normalizedEmail || !password) {
    // Throw an error to stop the current control flow.
    throw new Error('Email and password are required');
  }

  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await clientQuery(
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO users (email, password, role, email_verified_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      // Contribute this line to the enclosing declaration or statement.
      [normalizedEmail, password, role, emailVerifiedAt || null]
    );

    // Return the resulting value to the caller.
    return mapSqlUser(result.rows[0]);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Unique email index race → stable domain code for API mapping.
    if (isUniqueViolation(err)) {
      // Create the duplicate err constant.
      const duplicateErr = new Error('Email is already in use');
      // Update duplicateErr.code with the right-hand side value.
      duplicateErr.code = 'EMAIL_IN_USE';
      // Throw an error to stop the current control flow.
      throw duplicateErr;
    }
    // Throw an error to stop the current control flow.
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
  // Create the normalized id constant.
  const normalizedId = normalizeId(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedId || !tokenHash || !expiresAt) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE users
    SET
      email_verification_token_hash = $2,
      email_verification_expires_at = $3,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedId, tokenHash, expiresAt]
  );

  // Return the resulting value to the caller.
  return mapSqlUser(result.rows[0]) || null;
}

/**
 * mark email verified — mutates persisted state when applicable.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function markEmailVerified(userId, client = null) {
  // Create the normalized id constant.
  const normalizedId = normalizeId(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [normalizedId]
  );

  // Return the resulting value to the caller.
  return mapSqlUser(result.rows[0]) || null;
}

/**
 * clear verification token — mutates persisted state when applicable.
 * @param {string|number} userId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function clearVerificationToken(userId, client = null) {
  // Create the normalized id constant.
  const normalizedId = normalizeId(userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedId) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE users
    SET
      email_verification_token_hash = NULL,
      email_verification_expires_at = NULL,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedId]
  );

  // Return the resulting value to the caller.
  return mapSqlUser(result.rows[0]) || null;
}

/**
 * List users from SQL.
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function listUsers(client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT ${USER_SELECT}
    FROM users u
    ORDER BY u.email ASC
    `
  );

  // Return the resulting value to the caller.
  return result.rows.map(mapSqlUser);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  mapSqlUser,
  // Contribute this line to the enclosing declaration or statement.
  findUserByEmail,
  // Contribute this line to the enclosing declaration or statement.
  findUserById,
  // Contribute this line to the enclosing declaration or statement.
  findUserByVerificationTokenHash,
  // Contribute this line to the enclosing declaration or statement.
  createUser,
  // Contribute this line to the enclosing declaration or statement.
  setVerificationToken,
  // Contribute this line to the enclosing declaration or statement.
  markEmailVerified,
  // Contribute this line to the enclosing declaration or statement.
  clearVerificationToken,
  // Contribute this line to the enclosing declaration or statement.
  listUsers,
};
