/**
 * CORS origin parsing and Express middleware factory for credentialed SPA requests.
 * Cookie sessions require `credentials: true` and an explicit origin allow-list.
 */
const cors = require('cors');

/** Fallback allow-list used in non-production when CORS_ORIGINS is unset. */
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

/**
 * Parse a comma-separated CORS_ORIGINS string into trimmed origins.
 * @param {string|undefined|null} value - Raw env string (e.g. `https://a.com,https://b.com`)
 * @returns {string[]} Non-empty origin strings; empty array when unset/blank
 */
function parseCorsOrigins(value) {
  if (!value || !String(value).trim()) {
    return [];
  }

  return String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Prefer configured origins; otherwise use dev defaults, or empty in production.
 * @param {{ corsOrigins?: string[], isProd?: boolean }} config - Validated env config slice
 * @returns {string[]} Origins that may appear in the Access-Control-Allow-Origin path
 */
function getAllowedOrigins(config) {
  if (config.corsOrigins && config.corsOrigins.length > 0) {
    return config.corsOrigins;
  }

  // Dev convenience when CORS_ORIGINS was never set.
  if (!config.isProd) {
    return DEFAULT_DEV_ORIGINS;
  }

  // Production must set CORS_ORIGINS explicitly (validated in env.js).
  return [];
}

/**
 * Build cors middleware, or `null` when no origins are allowed (caller skips mounting).
 * Requests without an Origin header are allowed (same-origin / non-browser clients).
 * Side effects: none until the returned middleware runs on a request.
 * @param {object} config - Validated env config (needs corsOrigins / isProd)
 * @returns {import('express').RequestHandler|null}
 */
function createCorsMiddleware(config) {
  const allowedOrigins = new Set(getAllowedOrigins(config));

  // Caller treats null as “do not mount CORS” rather than deny-all middleware.
  if (allowedOrigins.size === 0) {
    return null;
  }

  return cors({
    origin(origin, callback) {
      // No Origin → non-browser or same-origin; allow through.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      // Disallowed origin: cors responds without ACAO (browser blocks).
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Correlation-Id',
    ],
  });
}

module.exports = {
  DEFAULT_DEV_ORIGINS,
  parseCorsOrigins,
  getAllowedOrigins,
  createCorsMiddleware,
};
