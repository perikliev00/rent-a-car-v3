/**
 * express-rate-limit factories and named limiters for auth, admin, checkout, etc.
 * Limits are overridable via RATE_LIMIT_* environment variables.
 */
const rateLimit = require('express-rate-limit');
const apiResponse = require('../utils/apiResponse');
const { TooManyRequestsError } = require('../utils/appError');
const logger = require('../utils/logger');

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Default 429 handler using the standard API error envelope.
 * Side effects: writes a TooManyRequests JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {import('express').Response}
 */
function defaultHandler(req, res) {
  const error = new TooManyRequestsError();
  return apiResponse.error(res, error.code, error.message, error.status, req);
}

/**
 * Read a non-negative integer from env, or return `fallback` when unset/invalid.
 * @param {string} envKey - Environment variable name
 * @param {number} fallback - Default when missing or not a finite ≥ 0 number
 * @returns {number}
 */
function readPositiveInt(envKey, fallback) {
  const raw = process.env[envKey];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Rate-limit handler that tags the response with an `X-RateLimit-Policy` header.
 * Side effects: sets header, logs a warning, then writes the default 429 body.
 * @param {string} policy - Policy label (e.g. `admin-read`) for ops/debugging
 * @returns {import('express').RequestHandler}
 */
function createPolicyHandler(policy) {
  return function handler(req, res) {
    res.setHeader('X-RateLimit-Policy', policy);
    logger.warn(
      {
        limiter: policy,
        method: req.method,
        path: req.originalUrl,
        userId: req.session?.user?.id,
      },
      'Rate limit exceeded'
    );
    return defaultHandler(req, res);
  };
}

/**
 * Build an express-rate-limit middleware with project defaults.
 * @param {object} options - Options passed through to express-rate-limit
 * @returns {import('express').RequestHandler}
 */
function createLimiter(options) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: defaultHandler,
    ...options,
  });
}

/**
 * Whether the request method is considered a read (skippable by write limiters).
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isReadMethod(req) {
  return READ_METHODS.has(String(req.method || '').toUpperCase());
}

/**
 * Detect the admin SSE realtime stream path (separate limiter bucket).
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isAdminRealtimeStream(req) {
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  return url.includes('/admin/realtime/stream');
}

/**
 * Prefer staff user id, then session id, then IP for admin limiter keys.
 * Custom keys disable IP validation because they are not always IPs.
 * @param {import('express').Request} req
 * @returns {string} Stable rate-limit bucket key
 */
function adminRateLimitKey(req) {
  if (req.session?.user?.id != null && String(req.session.user.id) !== '') {
    return `staff:${req.session.user.id}`;
  }
  if (req.sessionID) {
    return `session:${req.sessionID}`;
  }
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const ipKeyGenerator =
    typeof rateLimit.ipKeyGenerator === 'function' ? rateLimit.ipKeyGenerator : null;
  // Prefer library IPv6-safe key when available.
  return `ip:${ipKeyGenerator ? ipKeyGenerator(ip) : ip}`;
}

const DEFAULT_WINDOW_MS = readPositiveInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);

const authLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_AUTH_MAX', 10),
});

const loginLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_LOGIN_MAX', 5),
});

const signupLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_SIGNUP_MAX', 10),
});

const emailVerificationLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_EMAIL_VERIFICATION_MAX', 10),
});

const adminLimiterShared = {
  keyGenerator: adminRateLimitKey,
  // Custom staff/session keys are not IPs; skip the IPv6 keyGenerator check.
  validate: { ip: false },
};

// Applies only to safe methods; realtime SSE is excluded (own bucket).
const adminReadLimiter = createLimiter({
  ...adminLimiterShared,
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_ADMIN_READ_MAX', 1200),
  skip: (req) => !isReadMethod(req) || isAdminRealtimeStream(req),
  handler: createPolicyHandler('admin-read'),
});

// Applies only to mutating methods.
const adminWriteLimiter = createLimiter({
  ...adminLimiterShared,
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_ADMIN_WRITE_MAX', 300),
  skip: (req) => isReadMethod(req),
  handler: createPolicyHandler('admin-write'),
});

// Short window for SSE connect storms on /admin/realtime/stream.
const adminRealtimeLimiter = createLimiter({
  ...adminLimiterShared,
  windowMs: readPositiveInt('RATE_LIMIT_ADMIN_REALTIME_WINDOW_MS', 60 * 1000),
  max: readPositiveInt('RATE_LIMIT_ADMIN_REALTIME_MAX', 30),
  skip: (req) => !isAdminRealtimeStream(req),
  handler: createPolicyHandler('admin-realtime'),
});

const adminUploadLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_ADMIN_UPLOAD_MAX', 20),
});

const checkoutLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_CHECKOUT_MAX', 20),
});

const bookingLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_BOOKING_MAX', 30),
});

const chatLimiter = createLimiter({
  windowMs: readPositiveInt('RATE_LIMIT_CHAT_WINDOW_MS', 60 * 1000),
  max: readPositiveInt('RATE_LIMIT_CHAT_MAX', 60),
});

const contactLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_CONTACT_MAX', 10),
});

const accountUploadLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_ACCOUNT_UPLOAD_MAX', 20),
});

module.exports = {
  authLimiter,
  loginLimiter,
  signupLimiter,
  emailVerificationLimiter,
  adminReadLimiter,
  adminWriteLimiter,
  adminRealtimeLimiter,
  accountUploadLimiter,
  adminUploadLimiter,
  checkoutLimiter,
  bookingLimiter,
  chatLimiter,
  contactLimiter,
  createLimiter,
  defaultHandler,
  adminRateLimitKey,
  isAdminRealtimeStream,
  isReadMethod,
};
