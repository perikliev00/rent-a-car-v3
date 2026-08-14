const crypto = require('crypto');
const pool = require('../db/pool');
const { NotFoundError, ValidationError } = require('../utils/appError');

const ALLOWED_SCOPES = Object.freeze(['cars:read', 'meta:read']);
const ALLOWED_RATE_TIERS = Object.freeze(['standard', 'elevated']);

function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey), 'utf8').digest('hex');
}

function generateRawApiKey() {
  return `lux_${crypto.randomBytes(24).toString('hex')}`;
}

function normalizeScopes(scopes) {
  const list = Array.isArray(scopes) ? scopes : [];
  const unique = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
  for (const scope of unique) {
    if (!ALLOWED_SCOPES.includes(scope)) {
      throw new ValidationError(`Invalid API key scope: ${scope}`);
    }
  }
  if (unique.length === 0) {
    return [...ALLOWED_SCOPES];
  }
  return unique;
}

function mapRow(row) {
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

async function listApiKeys() {
  const result = await pool.query(
    `SELECT id, name, key_prefix, scopes, rate_tier, created_by_user_id,
            last_used_at, revoked_at, created_at
     FROM api_keys
     ORDER BY created_at DESC`
  );
  return result.rows.map(mapRow);
}

async function createApiKey({ name, scopes, rateTier, createdByUserId }) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new ValidationError('API key name is required.');
  }

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

async function revokeApiKey(id) {
  const result = await pool.query(
    `UPDATE api_keys
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE id = $1
     RETURNING id, name, key_prefix, scopes, rate_tier, created_by_user_id,
               last_used_at, revoked_at, created_at`,
    [id]
  );
  if (!result.rows[0]) {
    throw new NotFoundError('API key not found.');
  }
  return mapRow(result.rows[0]);
}

async function verifyApiKey(rawKey) {
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
  if (!row || row.revoked_at) {
    return null;
  }

  pool
    .query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id])
    .catch(() => {});

  return mapRow(row);
}

function keyHasScope(apiKey, scope) {
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
