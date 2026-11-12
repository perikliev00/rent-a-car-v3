/**
 * Public API key management: create/list/revoke keys and verify inbound raw keys.
 * Only the SHA-256 hash is stored; the plaintext key is returned once at creation.
 */
const crypto = require('crypto');
// Require the '../db/pool' module as pool.
const pool = require('../db/pool');
// Destructure object properties into local variables.
const { NotFoundError, ValidationError } = require('../utils/appError');

// Create the allowed scopes constant.
const ALLOWED_SCOPES = Object.freeze(['cars:read', 'meta:read']);
// Create the allowed rate tiers constant.
const ALLOWED_RATE_TIERS = Object.freeze(['standard', 'elevated']);

/** @param {string} rawKey @returns {string} hex digest for storage/lookup */
function hashApiKey(rawKey) {
  // Return the resulting value to the caller.
  return crypto.createHash('sha256').update(String(rawKey), 'utf8').digest('hex');
}

/** Generate a new raw key (shown once); prefix is stored for admin display. */
function generateRawApiKey() {
  // Return the resulting value to the caller.
  return `lux_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Validate and dedupe scopes; empty input → all ALLOWED_SCOPES.
 * @param {string[]|*} scopes
 * @returns {string[]}
 * @throws {ValidationError} when a scope is not allowed
 */
function normalizeScopes(scopes) {
  // Create the list constant.
  const list = Array.isArray(scopes) ? scopes : [];
  // Create the unique constant.
  const unique = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
  // Iterate using the loop initializer, condition, and step.
  for (const scope of unique) {
    // Guard: early-return or throw when required input is missing/invalid.
    if (!ALLOWED_SCOPES.includes(scope)) {
      // Throw an error to stop the current control flow.
      throw new ValidationError(`Invalid API key scope: ${scope}`);
    }
  }
  // Empty scopes means "full public API access" within ALLOWED_SCOPES.
  if (unique.length === 0) {
    // Return the resulting value to the caller.
    return [...ALLOWED_SCOPES];
  }
  // Return the resulting value to the caller.
  return unique;
}

/**
 * Map an api_keys row to the public admin DTO (never includes key_hash).
 * @param {object|null|undefined} row
 * @returns {object|null}
 */
function mapRow(row) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the name field value.
    name: row.name,
    // Provide the key prefix field value.
    keyPrefix: row.key_prefix,
    // Provide the scopes field value.
    scopes: row.scopes || [],
    // Provide the rate tier field value.
    rateTier: row.rate_tier,
    // Provide the created by user id field value.
    createdByUserId: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    // Provide the last used at field value.
    lastUsedAt: row.last_used_at,
    // Provide the revoked at field value.
    revokedAt: row.revoked_at,
    // Provide the created at field value.
    createdAt: row.created_at,
  };
}

/**
 * List all API keys newest-first (includes revoked).
 * @returns {Promise<object[]>}
 */
async function listApiKeys() {
  // Create the result constant.
  const result = await pool.query(
    `SELECT id, name, key_prefix, scopes, rate_tier, created_by_user_id,
            last_used_at, revoked_at, created_at
     FROM api_keys
     ORDER BY created_at DESC`
  );
  // Return the resulting value to the caller.
  return result.rows.map(mapRow);
}

/**
 * Create an API key; returns { apiKey, rawKey } — rawKey is never stored again.
 * @param {{ name: string, scopes?: string[], rateTier?: string, createdByUserId?: * }} params
 */
async function createApiKey({ name, scopes, rateTier, createdByUserId }) {
  // Create the trimmed name constant.
  const trimmedName = String(name || '').trim();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!trimmedName) {
    // Throw an error to stop the current control flow.
    throw new ValidationError('API key name is required.');
  }

  // Persist hash + prefix only; plaintext is returned once to the creator.
  const normalizedScopes = normalizeScopes(scopes);
  // Create the tier constant.
  const tier = rateTier && ALLOWED_RATE_TIERS.includes(rateTier) ? rateTier : 'standard';
  // Create the raw key constant.
  const rawKey = generateRawApiKey();
  // Create the key hash constant.
  const keyHash = hashApiKey(rawKey);
  // Create the key prefix constant.
  const keyPrefix = rawKey.slice(0, 12);

  // Create the result constant.
  const result = await pool.query(
    `INSERT INTO api_keys (name, key_prefix, key_hash, scopes, rate_tier, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, key_prefix, scopes, rate_tier, created_by_user_id,
               last_used_at, revoked_at, created_at`,
    // Contribute this line to the enclosing declaration or statement.
    [trimmedName, keyPrefix, keyHash, normalizedScopes, tier, createdByUserId || null]
  );

  // Return the resulting value to the caller.
  return {
    // Provide the api key field value.
    apiKey: mapRow(result.rows[0]),
    // Contribute this line to the enclosing declaration or statement.
    rawKey,
  };
}

/** Soft-revoke by setting revoked_at (idempotent if already revoked). */
async function revokeApiKey(id) {
  // Create the result constant.
  const result = await pool.query(
    `UPDATE api_keys
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE id = $1
     RETURNING id, name, key_prefix, scopes, rate_tier, created_by_user_id,
               last_used_at, revoked_at, created_at`,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Guard: early-return or throw when required input is missing/invalid.
  if (!result.rows[0]) {
    // Throw an error to stop the current control flow.
    throw new NotFoundError('API key not found.');
  }
  // Return the resulting value to the caller.
  return mapRow(result.rows[0]);
}

/**
 * Look up a non-revoked key by hash; updates last_used_at best-effort.
 * @param {string} rawKey
 * @returns {Promise<object|null>}
 */
async function verifyApiKey(rawKey) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!rawKey || typeof rawKey !== 'string') {
    // Return the resulting value to the caller.
    return null;
  }
  // Create the key hash constant.
  const keyHash = hashApiKey(rawKey.trim());
  // Create the result constant.
  const result = await pool.query(
    `SELECT id, name, key_prefix, scopes, rate_tier, created_by_user_id,
            last_used_at, revoked_at, created_at
     FROM api_keys
     WHERE key_hash = $1
     LIMIT 1`,
    // Contribute this line to the enclosing declaration or statement.
    [keyHash]
  );
  // Create the row constant.
  const row = result.rows[0];
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row || row.revoked_at) {
    // Return the resulting value to the caller.
    return null;
  }

  // Fire-and-forget last-used stamp so auth path stays fast.
  pool
    // Call .query to perform this step.
    .query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id])
    // Call .catch to perform this step.
    .catch(() => {});

  // Return the resulting value to the caller.
  return mapRow(row);
}

/**
 * Whether the verified key grants the given scope.
 * @param {object|null} apiKey
 * @param {string} scope
 * @returns {boolean}
 */
function keyHasScope(apiKey, scope) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!apiKey || !Array.isArray(apiKey.scopes)) {
    // Return the resulting value to the caller.
    return false;
  }
  // Return the resulting value to the caller.
  return apiKey.scopes.includes(scope);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_SCOPES,
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_RATE_TIERS,
  // Contribute this line to the enclosing declaration or statement.
  hashApiKey,
  // Contribute this line to the enclosing declaration or statement.
  generateRawApiKey,
  // Contribute this line to the enclosing declaration or statement.
  listApiKeys,
  // Contribute this line to the enclosing declaration or statement.
  createApiKey,
  // Contribute this line to the enclosing declaration or statement.
  revokeApiKey,
  // Contribute this line to the enclosing declaration or statement.
  verifyApiKey,
  // Contribute this line to the enclosing declaration or statement.
  keyHasScope,
};
