const SMTP_VARS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
const S3_VARS = ['S3_BUCKET', 'STORAGE_PUBLIC_BASE_URL'];
const PRIVATE_S3_VARS = ['PRIVATE_S3_BUCKET'];
// Payment routes (checkout, webhook, admin) are always mounted and stripe.js
// initializes the Stripe client at import time, so these are required outside test.
const STRIPE_VARS = ['STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET'];
const { parseCorsOrigins } = require('./cors');

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

let validatedConfig = null;

function isTruthy(value) {
  return ['true', '1', 'yes'].includes(String(value || '').toLowerCase());
}

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

const DEFAULT_FRONTEND_BASE_URL = 'http://localhost:5173';

function normalizeFrontendBaseUrl(value) {
  return String(value).trim().replace(/\/+$/, '');
}

function resolveFrontendBaseUrl() {
  if (!isEmpty(process.env.FRONTEND_BASE_URL)) {
    return normalizeFrontendBaseUrl(process.env.FRONTEND_BASE_URL);
  }

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return DEFAULT_FRONTEND_BASE_URL;
}

function missingKeys(keys) {
  return keys.filter((key) => isEmpty(process.env[key]));
}

function requireEnv(keys) {
  const missing = missingKeys(keys);
  if (missing.length > 0) {
    throw new Error(`Missing required env var(s): ${missing.join(', ')}`);
  }
}

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

function isDevelopmentHost(hostname) {
  return DEV_HOST_RE.test(String(hostname || '').trim());
}

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

  if (!allowPath && (parsed.pathname !== '/' || parsed.search || parsed.hash)) {
    throw new Error(`${label} must be an origin (scheme + host[+port]) in production`);
  }
}

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

function assertProductionStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET.trim();

  if (!secret.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be a real Stripe webhook secret (whsec_...) in production');
  }

  if (WEAK_STRIPE_WEBHOOK_SECRETS.has(secret.toLowerCase()) || secret.length < 20) {
    throw new Error('STRIPE_WEBHOOK_SECRET is a known weak/default value');
  }
}

function validateEmailConfig({ requireEnabled = false } = {}) {
  const emailEnabled = isTruthy(process.env.EMAIL_ENABLED);
  const configuredSmtpVars = SMTP_VARS.filter((key) => !isEmpty(process.env[key]));

  if (requireEnabled && !emailEnabled) {
    throw new Error('EMAIL_ENABLED must be true with full SMTP configuration in production');
  }

  if (emailEnabled) {
    requireEnv(SMTP_VARS);
    return;
  }

  if (configuredSmtpVars.length > 0 && configuredSmtpVars.length < SMTP_VARS.length) {
    const missing = SMTP_VARS.filter((key) => isEmpty(process.env[key]));
    throw new Error(
      `Partial SMTP configuration detected. Set EMAIL_ENABLED=true and configure all of: ${SMTP_VARS.join(', ')}. Missing: ${missing.join(', ')}`
    );
  }
}

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
  if (!stripeSecret.startsWith('sk_live_')) {
    throw new Error('STRIPE_SECRET must be a live key (sk_live_...) in production');
  }

  const storageDriver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  if (storageDriver !== 's3') {
    throw new Error(
      'STORAGE_DRIVER must be s3 in production (local public uploads are ephemeral without durable object storage)'
    );
  }
  requireEnv(S3_VARS);

  validatePrivateStorageConfig();
  validateEmailConfig({ requireEnabled: true });
}

function resolvePrivateStorageDriver() {
  return (process.env.PRIVATE_STORAGE_DRIVER || 'local').toLowerCase();
}

function validatePrivateStorageConfig() {
  const driver = resolvePrivateStorageDriver();

  if (driver === 's3') {
    requireEnv(PRIVATE_S3_VARS);
    return;
  }

  if (driver !== 'local') {
    throw new Error(`Unsupported PRIVATE_STORAGE_DRIVER: ${driver}`);
  }

  if (!isTruthy(process.env.PRIVATE_STORAGE_PERSISTENT)) {
    throw new Error(
      'Private document storage is local and ephemeral. Mount a persistent volume at uploads/private and set PRIVATE_STORAGE_PERSISTENT=true, or set PRIVATE_STORAGE_DRIVER=s3 with PRIVATE_S3_BUCKET.'
    );
  }
}

function buildConfig() {
  const sessionCookieSameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
  const allowedSameSite = new Set(['lax', 'strict', 'none']);
  const isProd = process.env.NODE_ENV === 'production';
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
    sessionCookieSecure: isProd || resolvedSameSite === 'none',
    openApiDocsEnabled: isTruthy(process.env.OPENAPI_DOCS_ENABLED),
  };
}

function validateEnv() {
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
    validateEmailConfig();
  }

  validatedConfig = buildConfig();
  return validatedConfig;
}

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
