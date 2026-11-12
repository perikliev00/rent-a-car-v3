/**
 * Environment validation and typed config access for the LuxRide backend.
 * Call `validateEnv()` once at process bootstrap before reading `config`.
 *
 * Side effects: reads `process.env`; successful validation caches `validatedConfig`.
 */
const { URL } = require('node:url');

const SMTP_VARS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
const S3_VARS = ['S3_BUCKET', 'STORAGE_PUBLIC_BASE_URL'];
const PRIVATE_S3_VARS = ['PRIVATE_S3_BUCKET'];
// Payment routes (checkout, webhook, admin) are always mounted and stripe.js
// initializes the Stripe client at import time, so these are required outside test.
const STRIPE_VARS = ['STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET'];
const { parseCorsOrigins } = require('./cors');

/** Known-weak placeholders rejected even if length requirements are met. */
const WEAK_SESSION_SECRETS = new Set([
  'secret',
  'change-me',
  'replace_with_32_plus_random_bytes',
  'replace_me_with_32_plus_random_chars',
  'your-session-secret',
]);

const WEAK_STRIPE_WEBHOOK_SECRETS = new Set([
  'whsec_xxx',
  'whsec_test',
  'whsec_test_secret',
  'whsec_secret',
  'whsec_change_me',
]);

const DEV_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/i;

/** Cached result of the last successful `validateEnv()` call. */
let validatedConfig = null;

/**
 * Treat common truthy string forms as enabled flags.
 * @param {*} value - Raw env value (string, number, boolean, etc.)
 * @returns {boolean} True for `true` / `1` / `yes` (case-insensitive)
 */
function isTruthy(value) {
  return ['true', '1', 'yes'].includes(String(value || '').toLowerCase());
}

/**
 * Whether an env value is missing or only whitespace.
 * @param {*} value - Raw env value
 * @returns {boolean}
 */
function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

const DEFAULT_FRONTEND_BASE_URL = 'http://localhost:5173';

/**
 * Strip trailing slashes so redirect URLs compose cleanly.
 * @param {string} value - Absolute or relative base URL string
 * @returns {string} Trimmed URL without trailing `/`
 */
function normalizeFrontendBaseUrl(value) {
  return String(value).trim().replace(/\/+$/, '');
}

/**
 * Resolve the SPA base URL: env override, required in production, localhost default otherwise.
 * @returns {string|null} Normalized base URL, or `null` when missing in production
 */
function resolveFrontendBaseUrl() {
  if (!isEmpty(process.env.FRONTEND_BASE_URL)) {
    return normalizeFrontendBaseUrl(process.env.FRONTEND_BASE_URL);
  }

  // Production must set FRONTEND_BASE_URL explicitly (validated later).
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return DEFAULT_FRONTEND_BASE_URL;
}

/**
 * List which of the given keys are unset or blank in `process.env`.
 * @param {string[]} keys - Env var names to check
 * @returns {string[]} Missing key names
 */
function missingKeys(keys) {
  return keys.filter((key) => isEmpty(process.env[key]));
}

/**
 * Throw if any listed env var is missing or blank.
 * @param {string[]} keys - Required env var names
 * @returns {void}
 * @throws {Error} When any listed env var is missing or blank
 */
function requireEnv(keys) {
  const missing = missingKeys(keys);
  if (missing.length > 0) {
    throw new Error(`Missing required env var(s): ${missing.join(', ')}`);
  }
}

/**
 * Enforce minimum length and reject known default secrets.
 * Side effects: reads `SESSION_SECRET` from `process.env`.
 * @returns {void}
 * @throws {Error} When secret is too short or a known weak placeholder
 */
function assertSessionSecretStrength() {
  const secret = process.env.SESSION_SECRET.trim();
  const minLength = 32;

  if (secret.length < minLength) {
    throw new Error(`SESSION_SECRET must be at least ${minLength} characters`);
  }

  if (WEAK_SESSION_SECRETS.has(secret.toLowerCase())) {
    throw new Error('SESSION_SECRET is a known weak/default value');
  }
}

/**
 * Detect localhost-style hosts that must not appear in production URLs.
 * @param {string} hostname - Hostname portion of a URL
 * @returns {boolean}
 */
function isDevelopmentHost(hostname) {
  return DEV_HOST_RE.test(String(hostname || '').trim());
}

/**
 * Production URLs must be absolute HTTPS and not point at localhost-style hosts.
 * @param {string} label - Human-readable name used in error messages
 * @param {string} value - Absolute URL string to validate
 * @param {{ allowPath?: boolean }} [options] - When `allowPath` is false, only origin is allowed
 * @returns {void}
 * @throws {Error} When URL is invalid, non-HTTPS, or uses a development host
 */
function assertProductionUrl(label, value, { allowPath = true } = {}) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid absolute URL in production`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS in production`);
  }

  if (isDevelopmentHost(parsed.hostname)) {
    throw new Error(`${label} must not use a development host in production`);
  }

  // CORS origins must be scheme+host[+port] only (no path/query/hash).
  if (!allowPath && (parsed.pathname !== '/' || parsed.search || parsed.hash)) {
    throw new Error(`${label} must be an origin (scheme + host[+port]) in production`);
  }
}

/**
 * Ensure DATABASE_URL is a real postgres URL not pointing at localhost in production.
 * @param {string} databaseUrl - Connection string from env
 * @returns {void}
 * @throws {Error} When URL is invalid, wrong scheme, or development host
 */
function assertProductionDatabaseUrl(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL in production');
  }

  const protocol = parsed.protocol.replace(/:$/, '');
  if (!['postgres', 'postgresql'].includes(protocol)) {
    throw new Error('DATABASE_URL must use the postgres(ql) scheme in production');
  }

  if (isDevelopmentHost(parsed.hostname)) {
    throw new Error('DATABASE_URL must not point at a development host in production');
  }
}

/**
 * Reject placeholder or too-short Stripe webhook secrets in production.
 * @returns {void}
 * @throws {Error} When secret format or strength fails
 */
function assertProductionStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET.trim();

  if (!secret.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be a real Stripe webhook secret (whsec_...) in production');
  }

  if (WEAK_STRIPE_WEBHOOK_SECRETS.has(secret.toLowerCase()) || secret.length < 20) {
    throw new Error('STRIPE_WEBHOOK_SECRET is a known weak/default value');
  }
}

/**
 * When email is enabled, all SMTP vars are required; partial SMTP config is always rejected.
 * @param {{ requireEnabled?: boolean }} [options] - If true, EMAIL_ENABLED must be on (production)
 * @returns {void}
 * @throws {Error} When email requirements are not met
 */
function validateEmailConfig({ requireEnabled = false } = {}) {
  const emailEnabled = isTruthy(process.env.EMAIL_ENABLED);
  const configuredSmtpVars = SMTP_VARS.filter((key) => !isEmpty(process.env[key]));

  if (requireEnabled && !emailEnabled) {
    throw new Error('EMAIL_ENABLED must be true with full SMTP configuration in production');
  }

  // Fully enabled: every SMTP field must be present.
  if (emailEnabled) {
    requireEnv(SMTP_VARS);
    return;
  }

  // Partial SMTP without EMAIL_ENABLED=true is a common misconfiguration.
  if (configuredSmtpVars.length > 0 && configuredSmtpVars.length < SMTP_VARS.length) {
    const missing = SMTP_VARS.filter((key) => isEmpty(process.env[key]));
    throw new Error(
      `Partial SMTP configuration detected. Set EMAIL_ENABLED=true and configure all of: ${SMTP_VARS.join(', ')}. Missing: ${missing.join(', ')}`
    );
  }
}

/**
 * Additional production-only checks: live Stripe, CORS, durable storage, email, cookies.
 * @returns {void}
 * @throws {Error} On any production hardening failure
 */
function validateProductionSecurity() {
  assertSessionSecretStrength();

  if (isTruthy(process.env.STRIPE_STUB)) {
    throw new Error('STRIPE_STUB must be disabled in production');
  }

  assertProductionStripeWebhookSecret();
  assertProductionDatabaseUrl(process.env.DATABASE_URL);

  if (!process.env.CORS_ORIGINS || !String(process.env.CORS_ORIGINS).trim()) {
    throw new Error('CORS_ORIGINS must be set in production');
  }

  const frontendBaseUrl = normalizeFrontendBaseUrl(process.env.FRONTEND_BASE_URL);
  assertProductionUrl('FRONTEND_BASE_URL', frontendBaseUrl);

  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  for (const origin of corsOrigins) {
    assertProductionUrl('CORS_ORIGINS entry', origin, { allowPath: false });
  }

  const sessionCookieSameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
  // SameSite=None requires Secure cookies, which imply HTTPS frontend.
  if (sessionCookieSameSite === 'none' && !frontendBaseUrl.startsWith('https://')) {
    throw new Error(
      'SESSION_COOKIE_SAME_SITE=none requires FRONTEND_BASE_URL to use HTTPS in production'
    );
  }

  if (
    process.env.SESSION_COOKIE_SECURE !== undefined &&
    !isTruthy(process.env.SESSION_COOKIE_SECURE)
  ) {
    throw new Error('SESSION_COOKIE_SECURE must not be disabled in production');
  }

  const stripeSecret = process.env.STRIPE_SECRET.trim();
  const allowStripeTestModeInProduction = isTruthy(
    process.env.ALLOW_STRIPE_TEST_MODE_IN_PRODUCTION
  );

  const isLiveStripeKey = stripeSecret.startsWith('sk_live_');
  const isAllowedTestStripeKey =
    allowStripeTestModeInProduction && stripeSecret.startsWith('sk_test_');

  if (!isLiveStripeKey && !isAllowedTestStripeKey) {
    throw new Error(
      'STRIPE_SECRET must be a live key (sk_live_...) in production, unless ALLOW_STRIPE_TEST_MODE_IN_PRODUCTION=true'
    );
  }

  const storageDriver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  // Local disk uploads are ephemeral on most PaaS filesystems.
  if (storageDriver !== 's3') {
    throw new Error(
      'STORAGE_DRIVER must be s3 in production (local public uploads are ephemeral without durable object storage)'
    );
  }
  requireEnv(S3_VARS);

  validatePrivateStorageConfig();
  validateEmailConfig({ requireEnabled: true });
}

/**
 * Resolve private document storage driver (`local` or `s3`).
 * @returns {string} Lowercased driver name
 */
function resolvePrivateStorageDriver() {
  return (process.env.PRIVATE_STORAGE_DRIVER || 'local').toLowerCase();
}

/**
 * Local private storage must opt into persistence; S3 requires PRIVATE_S3_BUCKET.
 * @returns {void}
 * @throws {Error} When driver is unsupported or local persistence is not affirmed
 */
function validatePrivateStorageConfig() {
  const driver = resolvePrivateStorageDriver();

  if (driver === 's3') {
    requireEnv(PRIVATE_S3_VARS);
    return;
  }

  if (driver !== 'local') {
    throw new Error(`Unsupported PRIVATE_STORAGE_DRIVER: ${driver}`);
  }

  // Force operators to acknowledge ephemeral local private uploads.
  if (!isTruthy(process.env.PRIVATE_STORAGE_PERSISTENT)) {
    throw new Error(
      'Private document storage is local and ephemeral. Mount a persistent volume at uploads/private and set PRIVATE_STORAGE_PERSISTENT=true, or set PRIVATE_STORAGE_DRIVER=s3 with PRIVATE_S3_BUCKET.'
    );
  }
}

/**
 * Build the runtime config object from process.env (does not re-validate).
 * @returns {object} Typed config consumed by server, middleware, and services
 */
function buildConfig() {
  const sessionCookieSameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
  const allowedSameSite = new Set(['lax', 'strict', 'none']);
  const isProd = process.env.NODE_ENV === 'production';
  // Invalid SameSite values fall back to lax rather than crashing at cookie set.
  const resolvedSameSite = allowedSameSite.has(sessionCookieSameSite)
    ? sessionCookieSameSite
    : 'lax';

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProd,
    isTest: process.env.NODE_ENV === 'test',
    port: Number(process.env.PORT || 3000),
    databaseUrl: process.env.DATABASE_URL,
    sessionSecret: process.env.SESSION_SECRET,
    stripeSecret: process.env.STRIPE_SECRET,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    emailEnabled: isTruthy(process.env.EMAIL_ENABLED),
    storageDriver: (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
    privateStorageDriver: resolvePrivateStorageDriver(),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    frontendBaseUrl: resolveFrontendBaseUrl(),
    sessionCookieSameSite: resolvedSameSite,
    // Secure cookies in production, or whenever SameSite=None requires Secure.
    sessionCookieSecure: isProd || resolvedSameSite === 'none',
    openApiDocsEnabled: isTruthy(process.env.OPENAPI_DOCS_ENABLED),
  };
}

/**
 * Validate required env vars (and production hardening), then cache config.
 * Test NODE_ENV skips most checks and only builds config.
 * Side effects: sets module-level `validatedConfig`.
 * @returns {object} Cached config object
 * @throws {Error} When required vars or production checks fail
 */
function validateEnv() {
  // Tests supply stubs; avoid requiring real Stripe/DB secrets.
  if (process.env.NODE_ENV === 'test') {
    validatedConfig = buildConfig();
    return validatedConfig;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const required = ['DATABASE_URL', 'SESSION_SECRET', ...STRIPE_VARS];

  if (isProd) {
    required.push('FRONTEND_BASE_URL');
  }

  requireEnv(required);
  assertSessionSecretStrength();

  if (isProd) {
    validateProductionSecurity();
  } else {
    // Still reject partial SMTP in development.
    validateEmailConfig();
  }

  validatedConfig = buildConfig();
  return validatedConfig;
}

/**
 * Return the cached config after bootstrap validation.
 * @returns {object} Same object returned by `validateEnv()`
 * @throws {Error} If `validateEnv()` has not been called yet
 */
function getConfig() {
  if (!validatedConfig) {
    throw new Error('Environment not validated. Call validateEnv() during application bootstrap.');
  }

  return validatedConfig;
}

module.exports = {
  validateEnv,
  get config() {
    return getConfig();
  },
};
