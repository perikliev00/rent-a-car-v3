/**
 * Environment validation and typed config access for the LuxRide backend.
 * Call `validateEnv()` once at process bootstrap before reading `config`.
 *
 * Side effects: reads `process.env`; successful validation caches `validatedConfig`.
 */
const { URL } = require('node:url');

// Create the smtp vars constant.
const SMTP_VARS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
// Create the s3 vars constant.
const S3_VARS = ['S3_BUCKET', 'STORAGE_PUBLIC_BASE_URL'];
// Create the private s3 vars constant.
const PRIVATE_S3_VARS = ['PRIVATE_S3_BUCKET'];
// Payment routes (checkout, webhook, admin) are always mounted and stripe.js
// initializes the Stripe client at import time, so these are required outside test.
const STRIPE_VARS = ['STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET'];
// Destructure object properties into local variables.
const { parseCorsOrigins } = require('./cors');

/** Known-weak placeholders rejected even if length requirements are met. */
const WEAK_SESSION_SECRETS = new Set([
  // Supply the literal value used by the enclosing expression.
  'secret',
  // Supply the literal value used by the enclosing expression.
  'change-me',
  // Supply the literal value used by the enclosing expression.
  'replace_with_32_plus_random_bytes',
  // Supply the literal value used by the enclosing expression.
  'replace_me_with_32_plus_random_chars',
  // Supply the literal value used by the enclosing expression.
  'your-session-secret',
]);

// Create the weak stripe webhook secrets constant.
const WEAK_STRIPE_WEBHOOK_SECRETS = new Set([
  // Supply the literal value used by the enclosing expression.
  'whsec_xxx',
  // Supply the literal value used by the enclosing expression.
  'whsec_test',
  // Supply the literal value used by the enclosing expression.
  'whsec_test_secret',
  // Supply the literal value used by the enclosing expression.
  'whsec_secret',
  // Supply the literal value used by the enclosing expression.
  'whsec_change_me',
]);

// Create the dev host re constant.
const DEV_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/i;

/** Cached result of the last successful `validateEnv()` call. */
let validatedConfig = null;

/**
 * Treat common truthy string forms as enabled flags.
 * @param {*} value - Raw env value (string, number, boolean, etc.)
 * @returns {boolean} True for `true` / `1` / `yes` (case-insensitive)
 */
function isTruthy(value) {
  // Return the resulting value to the caller.
  return ['true', '1', 'yes'].includes(String(value || '').toLowerCase());
}

/**
 * Whether an env value is missing or only whitespace.
 * @param {*} value - Raw env value
 * @returns {boolean}
 */
function isEmpty(value) {
  // Return the resulting value to the caller.
  return value === undefined || value === null || String(value).trim() === '';
}

// Create the default frontend base url constant.
const DEFAULT_FRONTEND_BASE_URL = 'http://localhost:5173';

/**
 * Strip trailing slashes so redirect URLs compose cleanly.
 * @param {string} value - Absolute or relative base URL string
 * @returns {string} Trimmed URL without trailing `/`
 */
function normalizeFrontendBaseUrl(value) {
  // Return the resulting value to the caller.
  return String(value).trim().replace(/\/+$/, '');
}

/**
 * Resolve the SPA base URL: env override, required in production, localhost default otherwise.
 * @returns {string|null} Normalized base URL, or `null` when missing in production
 */
function resolveFrontendBaseUrl() {
  // Evaluate the condition and enter the branch when it is true.
  if (!isEmpty(process.env.FRONTEND_BASE_URL)) {
    // Return the resulting value to the caller.
    return normalizeFrontendBaseUrl(process.env.FRONTEND_BASE_URL);
  }

  // Production must set FRONTEND_BASE_URL explicitly (validated later).
  if (process.env.NODE_ENV === 'production') {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return DEFAULT_FRONTEND_BASE_URL;
}

/**
 * List which of the given keys are unset or blank in `process.env`.
 * @param {string[]} keys - Env var names to check
 * @returns {string[]} Missing key names
 */
function missingKeys(keys) {
  // Return the resulting value to the caller.
  return keys.filter((key) => isEmpty(process.env[key]));
}

/**
 * Throw if any listed env var is missing or blank.
 * @param {string[]} keys - Required env var names
 * @returns {void}
 * @throws {Error} When any listed env var is missing or blank
 */
function requireEnv(keys) {
  // Create the missing constant.
  const missing = missingKeys(keys);
  // Evaluate the condition and enter the branch when it is true.
  if (missing.length > 0) {
    // Throw an error to stop the current control flow.
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
  // Create the secret constant.
  const secret = process.env.SESSION_SECRET.trim();
  // Create the min length constant.
  const minLength = 32;

  // Evaluate the condition and enter the branch when it is true.
  if (secret.length < minLength) {
    // Throw an error to stop the current control flow.
    throw new Error(`SESSION_SECRET must be at least ${minLength} characters`);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (WEAK_SESSION_SECRETS.has(secret.toLowerCase())) {
    // Throw an error to stop the current control flow.
    throw new Error('SESSION_SECRET is a known weak/default value');
  }
}

/**
 * Detect localhost-style hosts that must not appear in production URLs.
 * @param {string} hostname - Hostname portion of a URL
 * @returns {boolean}
 */
function isDevelopmentHost(hostname) {
  // Return the resulting value to the caller.
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
  // Reserve the parsed variable for later assignment.
  let parsed;
  // Start a try block for operations that may fail.
  try {
    // Update parsed with the right-hand side value.
    parsed = new URL(value);
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Throw an error to stop the current control flow.
    throw new Error(`${label} must be a valid absolute URL in production`);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (parsed.protocol !== 'https:') {
    // Throw an error to stop the current control flow.
    throw new Error(`${label} must use HTTPS in production`);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (isDevelopmentHost(parsed.hostname)) {
    // Throw an error to stop the current control flow.
    throw new Error(`${label} must not use a development host in production`);
  }

  // CORS origins must be scheme+host[+port] only (no path/query/hash).
  if (!allowPath && (parsed.pathname !== '/' || parsed.search || parsed.hash)) {
    // Throw an error to stop the current control flow.
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
  // Reserve the parsed variable for later assignment.
  let parsed;
  // Start a try block for operations that may fail.
  try {
    // Update parsed with the right-hand side value.
    parsed = new URL(databaseUrl);
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Throw an error to stop the current control flow.
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL in production');
  }

  // Create the protocol constant.
  const protocol = parsed.protocol.replace(/:$/, '');
  // Evaluate the condition and enter the branch when it is true.
  if (!['postgres', 'postgresql'].includes(protocol)) {
    // Throw an error to stop the current control flow.
    throw new Error('DATABASE_URL must use the postgres(ql) scheme in production');
  }

  // Evaluate the condition and enter the branch when it is true.
  if (isDevelopmentHost(parsed.hostname)) {
    // Throw an error to stop the current control flow.
    throw new Error('DATABASE_URL must not point at a development host in production');
  }
}

/**
 * Reject placeholder or too-short Stripe webhook secrets in production.
 * @returns {void}
 * @throws {Error} When secret format or strength fails
 */
function assertProductionStripeWebhookSecret() {
  // Create the secret constant.
  const secret = process.env.STRIPE_WEBHOOK_SECRET.trim();

  // Evaluate the condition and enter the branch when it is true.
  if (!secret.startsWith('whsec_')) {
    // Throw an error to stop the current control flow.
    throw new Error('STRIPE_WEBHOOK_SECRET must be a real Stripe webhook secret (whsec_...) in production');
  }

  // Evaluate the condition and enter the branch when it is true.
  if (WEAK_STRIPE_WEBHOOK_SECRETS.has(secret.toLowerCase()) || secret.length < 20) {
    // Throw an error to stop the current control flow.
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
  // Create the email enabled constant.
  const emailEnabled = isTruthy(process.env.EMAIL_ENABLED);
  // Create the configured smtp vars constant.
  const configuredSmtpVars = SMTP_VARS.filter((key) => !isEmpty(process.env[key]));

  // Evaluate the condition and enter the branch when it is true.
  if (requireEnabled && !emailEnabled) {
    // Throw an error to stop the current control flow.
    throw new Error('EMAIL_ENABLED must be true with full SMTP configuration in production');
  }

  // Fully enabled: every SMTP field must be present.
  if (emailEnabled) {
    // Call requireEnv to perform this step.
    requireEnv(SMTP_VARS);
    // Return control to the caller with the following value.
    return;
  }

  // Partial SMTP without EMAIL_ENABLED=true is a common misconfiguration.
  if (configuredSmtpVars.length > 0 && configuredSmtpVars.length < SMTP_VARS.length) {
    // Create the missing constant.
    const missing = SMTP_VARS.filter((key) => isEmpty(process.env[key]));
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
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
  // Call assertSessionSecretStrength to perform this step.
  assertSessionSecretStrength();

  // Evaluate the condition and enter the branch when it is true.
  if (isTruthy(process.env.STRIPE_STUB)) {
    // Throw an error to stop the current control flow.
    throw new Error('STRIPE_STUB must be disabled in production');
  }

  // Call assertProductionStripeWebhookSecret to perform this step.
  assertProductionStripeWebhookSecret();
  // Call assertProductionDatabaseUrl to perform this step.
  assertProductionDatabaseUrl(process.env.DATABASE_URL);

  // Evaluate the condition and enter the branch when it is true.
  if (!process.env.CORS_ORIGINS || !String(process.env.CORS_ORIGINS).trim()) {
    // Throw an error to stop the current control flow.
    throw new Error('CORS_ORIGINS must be set in production');
  }

  // Create the frontend base url constant.
  const frontendBaseUrl = normalizeFrontendBaseUrl(process.env.FRONTEND_BASE_URL);
  // Call assertProductionUrl to perform this step.
  assertProductionUrl('FRONTEND_BASE_URL', frontendBaseUrl);

  // Create the cors origins constant.
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  // Iterate using the loop initializer, condition, and step.
  for (const origin of corsOrigins) {
    // Call assertProductionUrl to perform this step.
    assertProductionUrl('CORS_ORIGINS entry', origin, { allowPath: false });
  }

  // Create the session cookie same site constant.
  const sessionCookieSameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
  // SameSite=None requires Secure cookies, which imply HTTPS frontend.
  if (sessionCookieSameSite === 'none' && !frontendBaseUrl.startsWith('https://')) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      'SESSION_COOKIE_SAME_SITE=none requires FRONTEND_BASE_URL to use HTTPS in production'
    );
  }

  // Evaluate the condition and enter the branch when it is true.
  if (
    // Continue the surrounding logic with this statement.
    process.env.SESSION_COOKIE_SECURE !== undefined &&
    // Continue the surrounding logic with this statement.
    !isTruthy(process.env.SESSION_COOKIE_SECURE)
  // Continue the surrounding logic with this statement.
  ) {
    // Throw an error to stop the current control flow.
    throw new Error('SESSION_COOKIE_SECURE must not be disabled in production');
  }

  // Create the stripe secret constant.
  const stripeSecret = process.env.STRIPE_SECRET.trim();
  // Create the allow stripe test mode in production constant.
  const allowStripeTestModeInProduction = isTruthy(
    // Contribute this line to the enclosing declaration or statement.
    process.env.ALLOW_STRIPE_TEST_MODE_IN_PRODUCTION
  );

  // Create the is live stripe key constant.
  const isLiveStripeKey = stripeSecret.startsWith('sk_live_');
  // Create the is allowed test stripe key constant.
  const isAllowedTestStripeKey =
    // Continue the surrounding logic with this statement.
    allowStripeTestModeInProduction && stripeSecret.startsWith('sk_test_');

  // Evaluate the condition and enter the branch when it is true.
  if (!isLiveStripeKey && !isAllowedTestStripeKey) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      'STRIPE_SECRET must be a live key (sk_live_...) in production, unless ALLOW_STRIPE_TEST_MODE_IN_PRODUCTION=true'
    );
  }

  // Create the storage driver constant.
  const storageDriver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  // Local disk uploads are ephemeral on most PaaS filesystems.
  if (storageDriver !== 's3') {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      'STORAGE_DRIVER must be s3 in production (local public uploads are ephemeral without durable object storage)'
    );
  }
  // Call requireEnv to perform this step.
  requireEnv(S3_VARS);

  // Call validatePrivateStorageConfig to perform this step.
  validatePrivateStorageConfig();
  // Call validateEmailConfig to perform this step.
  validateEmailConfig({ requireEnabled: true });
}

/**
 * Resolve private document storage driver (`local` or `s3`).
 * @returns {string} Lowercased driver name
 */
function resolvePrivateStorageDriver() {
  // Return the resulting value to the caller.
  return (process.env.PRIVATE_STORAGE_DRIVER || 'local').toLowerCase();
}

/**
 * Local private storage must opt into persistence; S3 requires PRIVATE_S3_BUCKET.
 * @returns {void}
 * @throws {Error} When driver is unsupported or local persistence is not affirmed
 */
function validatePrivateStorageConfig() {
  // Create the driver constant.
  const driver = resolvePrivateStorageDriver();

  // Evaluate the condition and enter the branch when it is true.
  if (driver === 's3') {
    // Call requireEnv to perform this step.
    requireEnv(PRIVATE_S3_VARS);
    // Return control to the caller with the following value.
    return;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (driver !== 'local') {
    // Throw an error to stop the current control flow.
    throw new Error(`Unsupported PRIVATE_STORAGE_DRIVER: ${driver}`);
  }

  // Force operators to acknowledge ephemeral local private uploads.
  if (!isTruthy(process.env.PRIVATE_STORAGE_PERSISTENT)) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      'Private document storage is local and ephemeral. Mount a persistent volume at uploads/private and set PRIVATE_STORAGE_PERSISTENT=true, or set PRIVATE_STORAGE_DRIVER=s3 with PRIVATE_S3_BUCKET.'
    );
  }
}

/**
 * Build the runtime config object from process.env (does not re-validate).
 * @returns {object} Typed config consumed by server, middleware, and services
 */
function buildConfig() {
  // Create the session cookie same site constant.
  const sessionCookieSameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
  // Create the allowed same site constant.
  const allowedSameSite = new Set(['lax', 'strict', 'none']);
  // Create the is prod constant.
  const isProd = process.env.NODE_ENV === 'production';
  // Invalid SameSite values fall back to lax rather than crashing at cookie set.
  const resolvedSameSite = allowedSameSite.has(sessionCookieSameSite)
    // Contribute this line to the enclosing declaration or statement.
    ? sessionCookieSameSite
    // Contribute this line to the enclosing declaration or statement.
    : 'lax';

  // Return the resulting value to the caller.
  return {
    // Provide the node env field value.
    nodeEnv: process.env.NODE_ENV || 'development',
    // Contribute this line to the enclosing declaration or statement.
    isProd,
    // Provide the is test field value.
    isTest: process.env.NODE_ENV === 'test',
    // Provide the port field value.
    port: Number(process.env.PORT || 3000),
    // Provide the database url field value.
    databaseUrl: process.env.DATABASE_URL,
    // Provide the session secret field value.
    sessionSecret: process.env.SESSION_SECRET,
    // Provide the stripe secret field value.
    stripeSecret: process.env.STRIPE_SECRET,
    // Provide the stripe webhook secret field value.
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    // Provide the email enabled field value.
    emailEnabled: isTruthy(process.env.EMAIL_ENABLED),
    // Provide the storage driver field value.
    storageDriver: (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
    // Provide the private storage driver field value.
    privateStorageDriver: resolvePrivateStorageDriver(),
    // Provide the cors origins field value.
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    // Provide the frontend base url field value.
    frontendBaseUrl: resolveFrontendBaseUrl(),
    // Provide the session cookie same site field value.
    sessionCookieSameSite: resolvedSameSite,
    // Secure cookies in production, or whenever SameSite=None requires Secure.
    sessionCookieSecure: isProd || resolvedSameSite === 'none',
    // Provide the open api docs enabled field value.
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
    // Update validatedConfig with the right-hand side value.
    validatedConfig = buildConfig();
    // Return the resulting value to the caller.
    return validatedConfig;
  }

  // Create the is prod constant.
  const isProd = process.env.NODE_ENV === 'production';
  // Create the required constant.
  const required = ['DATABASE_URL', 'SESSION_SECRET', ...STRIPE_VARS];

  // Evaluate the condition and enter the branch when it is true.
  if (isProd) {
    // Call required.push to perform this step.
    required.push('FRONTEND_BASE_URL');
  }

  // Call requireEnv to perform this step.
  requireEnv(required);
  // Call assertSessionSecretStrength to perform this step.
  assertSessionSecretStrength();

  // Evaluate the condition and enter the branch when it is true.
  if (isProd) {
    // Call validateProductionSecurity to perform this step.
    validateProductionSecurity();
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Still reject partial SMTP in development.
    validateEmailConfig();
  }

  // Update validatedConfig with the right-hand side value.
  validatedConfig = buildConfig();
  // Return the resulting value to the caller.
  return validatedConfig;
}

/**
 * Return the cached config after bootstrap validation.
 * @returns {object} Same object returned by `validateEnv()`
 * @throws {Error} If `validateEnv()` has not been called yet
 */
function getConfig() {
  // Evaluate the condition and enter the branch when it is true.
  if (!validatedConfig) {
    // Throw an error to stop the current control flow.
    throw new Error('Environment not validated. Call validateEnv() during application bootstrap.');
  }

  // Return the resulting value to the caller.
  return validatedConfig;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  validateEnv,
  // Continue the surrounding logic with this statement.
  get config() {
    // Return the resulting value to the caller.
    return getConfig();
  },
};
