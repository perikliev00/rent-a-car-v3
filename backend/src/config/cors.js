/**
 * CORS origin parsing and Express middleware factory for credentialed SPA requests.
 * Cookie sessions require `credentials: true` and an explicit origin allow-list.
 */
const cors = require('cors');

/** Fallback allow-list used in non-production when CORS_ORIGINS is unset. */
const DEFAULT_DEV_ORIGINS = [
  // Supply the literal value used by the enclosing expression.
  'http://localhost:5173',
  // Supply the literal value used by the enclosing expression.
  'http://127.0.0.1:5173',
  // Supply the literal value used by the enclosing expression.
  'http://localhost:5174',
  // Supply the literal value used by the enclosing expression.
  'http://127.0.0.1:5174',
  // Supply the literal value used by the enclosing expression.
  'http://localhost:3001',
  // Supply the literal value used by the enclosing expression.
  'http://127.0.0.1:3001',
];

/**
 * Parse a comma-separated CORS_ORIGINS string into trimmed origins.
 * @param {string|undefined|null} value - Raw env string (e.g. `https://a.com,https://b.com`)
 * @returns {string[]} Non-empty origin strings; empty array when unset/blank
 */
function parseCorsOrigins(value) {
  // Evaluate the condition and enter the branch when it is true.
  if (!value || !String(value).trim()) {
    // Return the resulting value to the caller.
    return [];
  }

  // Return the resulting value to the caller.
  return String(value)
    // Call .split to perform this step.
    .split(',')
    // Call .map to perform this step.
    .map((origin) => origin.trim())
    // Call .filter to perform this step.
    .filter(Boolean);
}

/**
 * Prefer configured origins; otherwise use dev defaults, or empty in production.
 * @param {{ corsOrigins?: string[], isProd?: boolean }} config - Validated env config slice
 * @returns {string[]} Origins that may appear in the Access-Control-Allow-Origin path
 */
function getAllowedOrigins(config) {
  // Evaluate the condition and enter the branch when it is true.
  if (config.corsOrigins && config.corsOrigins.length > 0) {
    // Return the resulting value to the caller.
    return config.corsOrigins;
  }

  // Dev convenience when CORS_ORIGINS was never set.
  if (!config.isProd) {
    // Return the resulting value to the caller.
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
  // Create the allowed origins constant.
  const allowedOrigins = new Set(getAllowedOrigins(config));

  // Caller treats null as “do not mount CORS” rather than deny-all middleware.
  if (allowedOrigins.size === 0) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return cors({
    // Call origin to perform this step.
    origin(origin, callback) {
      // No Origin → non-browser or same-origin; allow through.
      if (!origin || allowedOrigins.has(origin)) {
        // Call callback to perform this step.
        callback(null, true);
        // Return control to the caller with the following value.
        return;
      }

      // Disallowed origin: cors responds without ACAO (browser blocks).
      callback(null, false);
    },
    // Provide the credentials field value.
    credentials: true,
    // Provide the methods field value.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Provide the allowed headers field value.
    allowedHeaders: [
      // Supply the literal value used by the enclosing expression.
      'Content-Type',
      // Supply the literal value used by the enclosing expression.
      'Authorization',
      // Supply the literal value used by the enclosing expression.
      'X-Requested-With',
      // Supply the literal value used by the enclosing expression.
      'X-CSRF-Token',
      // Supply the literal value used by the enclosing expression.
      'X-Correlation-Id',
    ],
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  DEFAULT_DEV_ORIGINS,
  // Contribute this line to the enclosing declaration or statement.
  parseCorsOrigins,
  // Contribute this line to the enclosing declaration or statement.
  getAllowedOrigins,
  // Contribute this line to the enclosing declaration or statement.
  createCorsMiddleware,
};
