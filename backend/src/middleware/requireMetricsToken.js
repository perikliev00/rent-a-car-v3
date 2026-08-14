const crypto = require('crypto');
const logger = require('../utils/logger');

const isProd = process.env.NODE_ENV === 'production';
const metricsToken = process.env.METRICS_TOKEN || '';

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

function safeEqual(a, b) {
  if (!a || !b) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

function extractToken(req) {
  const authHeader = req.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  return req.get('x-metrics-token') || '';
}

function isIpAllowed(req) {
  if (!allowedIps) {
    return false;
  }

  return allowedIps.has(req.ip);
}

function isTokenValid(req) {
  if (!metricsToken) {
    return false;
  }

  return safeEqual(extractToken(req), metricsToken);
}

function isMetricsConfigured() {
  return Boolean(metricsToken || allowedIps);
}

function requireMetricsToken(req, res, next) {
  if (!isProd) {
    return next();
  }

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
