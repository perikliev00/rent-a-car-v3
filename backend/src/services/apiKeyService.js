/**
 * Public API key management: create/list/revoke keys and verify inbound raw keys.
 * Only the SHA-256 hash is stored; the plaintext key is returned once at creation.
 */
const crypto = require('crypto');
const pool = require('../db/pool');
const { NotFoundError, ValidationError } = require('../utils/appError');

const ALLOWED_SCOPES = Object.freeze(['cars:read', 'meta:read']);
const ALLOWED_RATE_TIERS = Object.freeze(['standard', 'elevated']);

/** @param {string} rawKey @returns {string} hex digest for storage/lookup */
function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey), 'utf8').digest('hex');
}

/** Generate a new raw key (shown once); prefix is stored for admin display. */
function generateRawApiKey() {
  return `lux_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Validate and dedupe scopes; empty input → all ALLOWED_SCOPES.
 * @param {string[]|*} scopes
 * @returns {string[]}
 * @throws {ValidationError} when a scope is not allowed
 */
function normalizeScopes(scopes) {
  const list = Array.isArray(scopes) ? scopes : [];
  const unique = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
  for (const scope of unique) {
    // Guard: early-return or throw when required input is missing/invalid.
    if (!ALLOWED_SCOPES.includes(scope)) {
      throw new ValidationError(`Invalid API key scope: ${scope}`);
    }
  }
  // Empty scopes means "full public API access" within ALLOWED_SCOPES.
  if (unique.length === 0) {
    return [...ALLOWED_SCOPES];
  }
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
  return {
    id: String(row.id),
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes || [],
    rateTier: row.rate_tier,
    createdByUserId: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/**
 * List all API keys newest-first (includes revoked).
 * @returns {Promise<object[]>}
 */
async function listApiKeys() {
  const result = await pool.query(
    `SELECT id, name, key_prefix, scopes, rate_tier, created_by_user_id,
            last_used_at, revoked_at, created_at
     FROM api_keys
     ORDER BY created_at DESC`
  );
  return result.rows.map(mapRow);
}

/**
 * Create an API key; returns { apiKey, rawKey } — rawKey is never stored again.
 * @param {{ name: string, scopes?: string[], rateTier?: string, createdByUserId?: * }} params
 */
async function createApiKey({ name, scopes, rateTier, createdByUserId }) {
  const trimmedName = String(name || '').trim();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!trimmedName) {
    throw new ValidationError('API key name is required.');
  }

  // Persist hash + prefix only; plaintext is returned once to the creator.
  const normalizedScopes = normalizeScopes(scopes);
  const tier = rateTier && ALLOWED_RATE_TIERS.includes(rateTier) ? rateTier : 'standard';
  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  const result = await pool.query(
    `INSERT INTO api_keys (name, key_prefix, key_hash, scopes, rate_tier, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, key_prefix, scopes, rate_tier, created_by_user_id,
               last_used_at, revoked_at, created_at`,
    [trimmedName, keyPrefix, keyHash, normalizedScopes, tier, createdByUserId || null]
  );

  return {
    apiKey: mapRow(result.rows[0]),
    rawKey,
  };
}

/** Soft-revoke by setting revoked_at (idempotent if already revoked). */
async function revokeApiKey(id) {
  const result = await pool.query(
    `UPDATE api_keys
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE id = $1
     RETURNING id, name, key_prefix, scopes, rate_tier, created_by_user_id,
               last_used_at, revoked_at, created_at`,
    [id]
  );
  // Guard: early-return or throw when required input is missing/invalid.
  if (!result.rows[0]) {
    throw new NotFoundError('API key not found.');
  }
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
    return null;
  }
  const keyHash = hashApiKey(rawKey.trim());
  const result = await pool.query(
    `SELECT id, name, key_prefix, scopes, rate_tier, created_by_user_id,
            last_used_at, revoked_at, created_at
     FROM api_keys
     WHERE key_hash = $1
     LIMIT 1`,
    [keyHash]
  );
  const row = result.rows[0];
  // Guard: early-return or throw when required input is missing/invalid.
  if (!row || row.revoked_at) {
    return null;
  }

  // Fire-and-forget last-used stamp so auth path stays fast.
  pool
    .query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id])
    .catch(() => {});

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
    return false;
  }
  return apiKey.scopes.includes(scope);
}

module.exports = {
  ALLOWED_SCOPES,
  ALLOWED_RATE_TIERS,
  hashApiKey,
  generateRawApiKey,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  verifyApiKey,
  keyHasScope,
};
