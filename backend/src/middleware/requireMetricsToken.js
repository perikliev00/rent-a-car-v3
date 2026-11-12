/**
 * Protects `/metrics` and `/prometheus` in production via bearer/token or IP allow-list.
 * Non-production environments skip the check.
 */
const crypto = require('crypto');
// Require the '../utils/logger' module as logger.
const logger = require('../utils/logger');

// Create the is prod constant.
const isProd = process.env.NODE_ENV === 'production';
// Create the metrics token constant.
const metricsToken = process.env.METRICS_TOKEN || '';

/**
 * Parse METRICS_ALLOWED_IPS into a Set, or null when unset/empty.
 * @returns {Set<string>|null} Allowed client IPs, or null when unset
 */
function parseAllowedIps() {
  // Create the raw constant.
  const raw = process.env.METRICS_ALLOWED_IPS;
  // Evaluate the condition and enter the branch when it is true.
  if (!raw) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the ips constant.
  const ips = raw
    // Call .split to perform this step.
    .split(',')
    // Call .map to perform this step.
    .map((entry) => entry.trim())
    // Call .filter to perform this step.
    .filter(Boolean);

  // Return the resulting value to the caller.
  return ips.length ? new Set(ips) : null;
}

// Create the allowed ips constant.
const allowedIps = parseAllowedIps();

/**
 * Constant-time string compare; returns false when lengths differ.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  // Evaluate the condition and enter the branch when it is true.
  if (!a || !b) {
    // Return the resulting value to the caller.
    return false;
  }

  // Create the buf a constant.
  const bufA = Buffer.from(a);
  // Create the buf b constant.
  const bufB = Buffer.from(b);

  // timingSafeEqual throws on length mismatch — treat as non-equal.
  if (bufA.length !== bufB.length) {
    // Return the resulting value to the caller.
    return false;
  }

  // Return the resulting value to the caller.
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Read metrics credentials from Authorization Bearer or X-Metrics-Token.
 * @param {import('express').Request} req
 * @returns {string} Presented token (may be empty)
 */
function extractToken(req) {
  // Create the auth header constant.
  const authHeader = req.get('authorization') || '';
  // Evaluate the condition and enter the branch when it is true.
  if (authHeader.startsWith('Bearer ')) {
    // Return the resulting value to the caller.
    return authHeader.slice('Bearer '.length);
  }

  // Return the resulting value to the caller.
  return req.get('x-metrics-token') || '';
}

/**
 * Whether the request IP is on the allow-list.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isIpAllowed(req) {
  // Evaluate the condition and enter the branch when it is true.
  if (!allowedIps) {
    // Return the resulting value to the caller.
    return false;
  }

  // Return the resulting value to the caller.
  return allowedIps.has(req.ip);
}

/**
 * Whether the request presents a valid metrics token.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isTokenValid(req) {
  // Evaluate the condition and enter the branch when it is true.
  if (!metricsToken) {
    // Return the resulting value to the caller.
    return false;
  }

  // Return the resulting value to the caller.
  return safeEqual(extractToken(req), metricsToken);
}

/**
 * True when either a token or IP allow-list is configured.
 * @returns {boolean}
 */
function isMetricsConfigured() {
  // Return the resulting value to the caller.
  return Boolean(metricsToken || allowedIps);
}

/**
 * In production, require a configured token or allowed IP; otherwise 401/503.
 * Side effects: may write 401/503 JSON; in non-prod always continues.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void|import('express').Response}
 */
function requireMetricsToken(req, res, next) {
  // Evaluate the condition and enter the branch when it is true.
  if (!isProd) {
    // Return the resulting value to the caller.
    return next();
  }

  // Misconfigured prod: fail closed rather than expose metrics publicly.
  if (!isMetricsConfigured()) {
    // Return the resulting value to the caller.
    return res.status(503).json({
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'METRICS_UNAVAILABLE',
        // Provide the message field value.
        message: 'Metrics endpoint is not configured.',
      },
    });
  }

  // Evaluate the condition and enter the branch when it is true.
  if (isIpAllowed(req) || isTokenValid(req)) {
    // Return the resulting value to the caller.
    return next();
  }

  // Return the resulting value to the caller.
  return res.status(401).json({
    // Provide the error field value.
    error: {
      // Provide the code field value.
      code: 'UNAUTHORIZED',
      // Provide the message field value.
      message: 'Valid metrics credentials required.',
    },
  });
}

// Evaluate the condition and enter the branch when it is true.
if (isProd && !isMetricsConfigured()) {
  // Call logger.warn to perform this step.
  logger.warn(
    // Supply the literal value used by the enclosing expression.
    'METRICS_TOKEN and METRICS_ALLOWED_IPS are unset; /metrics is disabled in production'
  );
}

// Assign the CommonJS module exports.
module.exports = requireMetricsToken;
