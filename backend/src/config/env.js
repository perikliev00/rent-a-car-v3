const SMTP_VARS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
const S3_VARS = ['S3_BUCKET', 'STORAGE_PUBLIC_BASE_URL'];
// Payment routes (checkout, webhook, admin) are always mounted and stripe.js
// initializes the Stripe client at import time, so these are required outside test.
const STRIPE_VARS = ['STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET'];
const { parseCorsOrigins } = require('./cors');
const { URL } = require('node:url');

const WEAK_SESSION_SECRETS = new Set([
  'secret',
  'change-me',
  'replace_with_32_plus_random_bytes',
  'your-session-secret',
]);

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

function validateEmailConfig({ requireEnabled = false } = {}) {
  const emailEnabled = isTruthy(process.env.EMAIL_ENABLED);
  const configuredSmtpVars = SMTP_VARS.filter((key) => !isEmpty(process.env[key]));

  if (requireEnabled && !emailEnabled) {
    throw new Error(
      `EMAIL_ENABLED=true and a complete SMTP configuration (${SMTP_VARS.join(', ')}) are required in production`
    );
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

function assertAbsoluteHttpsUrl(value, name) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL in production`);
  }

  if (parsed.protocol !== 'https:' || !parsed.hostname) {
    throw new Error(`${name} must be an absolute HTTPS URL in production`);
  }
}

function validateProductionSecurity() {
  assertSessionSecretStrength();

  if (!process.env.CORS_ORIGINS || !String(process.env.CORS_ORIGINS).trim()) {
    throw new Error('CORS_ORIGINS must be set in production');
  }

  assertAbsoluteHttpsUrl(process.env.FRONTEND_BASE_URL, 'FRONTEND_BASE_URL');

  const sessionCookieSameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (sessionCookieSameSite === 'none' && !process.env.FRONTEND_BASE_URL?.startsWith('https://')) {
    throw new Error(
      'SESSION_COOKIE_SAME_SITE=none requires FRONTEND_BASE_URL to use HTTPS in production'
    );
  }

  const stripeSecret = process.env.STRIPE_SECRET.trim();
  if (!stripeSecret.startsWith('sk_live_')) {
    throw new Error('STRIPE_SECRET must be a live key (sk_live_...) in production');
  }

  const storageDriver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  if (storageDriver === 's3') {
    requireEnv(S3_VARS);
  }
}

function buildConfig() {
  const sessionCookieSameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
  const allowedSameSite = new Set(['lax', 'strict', 'none']);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProd: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
    port: Number(process.env.PORT || 3000),
    databaseUrl: process.env.DATABASE_URL,
    sessionSecret: process.env.SESSION_SECRET,
    stripeSecret: process.env.STRIPE_SECRET,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    emailEnabled: isTruthy(process.env.EMAIL_ENABLED),
    storageDriver: (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    frontendBaseUrl: resolveFrontendBaseUrl(),
    sessionCookieSameSite: allowedSameSite.has(sessionCookieSameSite)
      ? sessionCookieSameSite
      : 'lax',
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
  validateEmailConfig({ requireEnabled: isProd });

  if (isProd) {
    validateProductionSecurity();
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
