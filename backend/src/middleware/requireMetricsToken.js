/**
 * Protects `/metrics` and `/prometheus` in production via bearer/token or IP allow-list.
 * Non-production environments skip the check.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

const isProd = process.env.NODE_ENV === 'production';
const metricsToken = process.env.METRICS_TOKEN || '';

/**
 * Parse METRICS_ALLOWED_IPS into a Set, or null when unset/empty.
 * @returns {Set<string>|null} Allowed client IPs, or null when unset
 */
function parseAllowedIps() {
  const raw = process.env.METRICS_ALLOWED_IPS;
  if (!raw) {
    return null;
  }

  const ips = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return ips.length ? new Set(ips) : null;
}

const allowedIps = parseAllowedIps();

/**
 * Constant-time string compare; returns false when lengths differ.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (!a || !b) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // timingSafeEqual throws on length mismatch — treat as non-equal.
  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Read metrics credentials from Authorization Bearer or X-Metrics-Token.
 * @param {import('express').Request} req
 * @returns {string} Presented token (may be empty)
 */
function extractToken(req) {
  const authHeader = req.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  return req.get('x-metrics-token') || '';
}

/**
 * Whether the request IP is on the allow-list.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isIpAllowed(req) {
  if (!allowedIps) {
    return false;
  }

  return allowedIps.has(req.ip);
}

/**
 * Whether the request presents a valid metrics token.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isTokenValid(req) {
  if (!metricsToken) {
    return false;
  }

  return safeEqual(extractToken(req), metricsToken);
}

/**
 * True when either a token or IP allow-list is configured.
 * @returns {boolean}
 */
function isMetricsConfigured() {
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
  if (!isProd) {
    return next();
  }

  // Misconfigured prod: fail closed rather than expose metrics publicly.
  if (!isMetricsConfigured()) {
    return res.status(503).json({
      error: {
        code: 'METRICS_UNAVAILABLE',
        message: 'Metrics endpoint is not configured.',
      },
    });
  }

  if (isIpAllowed(req) || isTokenValid(req)) {
    return next();
  }

  return res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Valid metrics credentials required.',
    },
  });
}

if (isProd && !isMetricsConfigured()) {
  logger.warn(
    'METRICS_TOKEN and METRICS_ALLOWED_IPS are unset; /metrics is disabled in production'
  );
}

module.exports = requireMetricsToken;
