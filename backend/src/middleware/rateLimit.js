/**
 * express-rate-limit factories and named limiters for auth, admin, checkout, etc.
 * Limits are overridable via RATE_LIMIT_* environment variables.
 */
const rateLimit = require('express-rate-limit');
// Require the '../utils/apiResponse' module as apiResponse.
const apiResponse = require('../utils/apiResponse');
// Destructure object properties into local variables.
const { TooManyRequestsError } = require('../utils/appError');
// Require the '../utils/logger' module as logger.
const logger = require('../utils/logger');

// Create the read methods constant.
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Default 429 handler using the standard API error envelope.
 * Side effects: writes a TooManyRequests JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {import('express').Response}
 */
function defaultHandler(req, res) {
  // Create the error constant.
  const error = new TooManyRequestsError();
  // Return the resulting value to the caller.
  return apiResponse.error(res, error.code, error.message, error.status, req);
}

/**
 * Read a non-negative integer from env, or return `fallback` when unset/invalid.
 * @param {string} envKey - Environment variable name
 * @param {number} fallback - Default when missing or not a finite ≥ 0 number
 * @returns {number}
 */
function readPositiveInt(envKey, fallback) {
  // Create the raw constant.
  const raw = process.env[envKey];
  // Evaluate the condition and enter the branch when it is true.
  if (raw === undefined || raw === '') {
    // Return the resulting value to the caller.
    return fallback;
  }
  // Create the value constant.
  const value = Number(raw);
  // Return the resulting value to the caller.
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Rate-limit handler that tags the response with an `X-RateLimit-Policy` header.
 * Side effects: sets header, logs a warning, then writes the default 429 body.
 * @param {string} policy - Policy label (e.g. `admin-read`) for ops/debugging
 * @returns {import('express').RequestHandler}
 */
function createPolicyHandler(policy) {
  // Return the resulting value to the caller.
  return function handler(req, res) {
    // Call res.setHeader to perform this step.
    res.setHeader('X-RateLimit-Policy', policy);
    // Call logger.warn to perform this step.
    logger.warn(
      {
        // Provide the limiter field value.
        limiter: policy,
        // Provide the method field value.
        method: req.method,
        // Provide the path field value.
        path: req.originalUrl,
        // Provide the user id field value.
        userId: req.session?.user?.id,
      },
      // Supply the literal value used by the enclosing expression.
      'Rate limit exceeded'
    );
    // Return the resulting value to the caller.
    return defaultHandler(req, res);
  };
}

/**
 * Build an express-rate-limit middleware with project defaults.
 * @param {object} options - Options passed through to express-rate-limit
 * @returns {import('express').RequestHandler}
 */
function createLimiter(options) {
  // Return the resulting value to the caller.
  return rateLimit({
    // Provide the standard headers field value.
    standardHeaders: true,
    // Provide the legacy headers field value.
    legacyHeaders: false,
    // Provide the handler field value.
    handler: defaultHandler,
    // Spread options into the surrounding structure.
    ...options,
  });
}

/**
 * Whether the request method is considered a read (skippable by write limiters).
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isReadMethod(req) {
  // Return the resulting value to the caller.
  return READ_METHODS.has(String(req.method || '').toUpperCase());
}

/**
 * Detect the admin SSE realtime stream path (separate limiter bucket).
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isAdminRealtimeStream(req) {
  // Create the url constant.
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  // Return the resulting value to the caller.
  return url.includes('/admin/realtime/stream');
}

/**
 * Prefer staff user id, then session id, then IP for admin limiter keys.
 * Custom keys disable IP validation because they are not always IPs.
 * @param {import('express').Request} req
 * @returns {string} Stable rate-limit bucket key
 */
function adminRateLimitKey(req) {
  // Evaluate the condition and enter the branch when it is true.
  if (req.session?.user?.id != null && String(req.session.user.id) !== '') {
    // Return the resulting value to the caller.
    return `staff:${req.session.user.id}`;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (req.sessionID) {
    // Return the resulting value to the caller.
    return `session:${req.sessionID}`;
  }
  // Create the ip constant.
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  // Create the ip key generator constant.
  const ipKeyGenerator =
    // Continue the surrounding logic with this statement.
    typeof rateLimit.ipKeyGenerator === 'function' ? rateLimit.ipKeyGenerator : null;
  // Prefer library IPv6-safe key when available.
  return `ip:${ipKeyGenerator ? ipKeyGenerator(ip) : ip}`;
}

// Create the default window ms constant.
const DEFAULT_WINDOW_MS = readPositiveInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);

// Create the auth limiter constant.
const authLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_AUTH_MAX', 10),
});

// Create the login limiter constant.
const loginLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_LOGIN_MAX', 5),
});

// Create the signup limiter constant.
const signupLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_SIGNUP_MAX', 10),
});

// Create the email verification limiter constant.
const emailVerificationLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_EMAIL_VERIFICATION_MAX', 10),
});

// Create the admin limiter shared constant.
const adminLimiterShared = {
  // Provide the key generator field value.
  keyGenerator: adminRateLimitKey,
  // Custom staff/session keys are not IPs; skip the IPv6 keyGenerator check.
  validate: { ip: false },
};

// Applies only to safe methods; realtime SSE is excluded (own bucket).
const adminReadLimiter = createLimiter({
  // Spread adminLimiterShared into the surrounding structure.
  ...adminLimiterShared,
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_ADMIN_READ_MAX', 1200),
  // Provide the skip field value.
  skip: (req) => !isReadMethod(req) || isAdminRealtimeStream(req),
  // Provide the handler field value.
  handler: createPolicyHandler('admin-read'),
});

// Applies only to mutating methods.
const adminWriteLimiter = createLimiter({
  // Spread adminLimiterShared into the surrounding structure.
  ...adminLimiterShared,
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_ADMIN_WRITE_MAX', 300),
  // Provide the skip field value.
  skip: (req) => isReadMethod(req),
  // Provide the handler field value.
  handler: createPolicyHandler('admin-write'),
});

// Short window for SSE connect storms on /admin/realtime/stream.
const adminRealtimeLimiter = createLimiter({
  // Spread adminLimiterShared into the surrounding structure.
  ...adminLimiterShared,
  // Provide the window ms field value.
  windowMs: readPositiveInt('RATE_LIMIT_ADMIN_REALTIME_WINDOW_MS', 60 * 1000),
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_ADMIN_REALTIME_MAX', 30),
  // Provide the skip field value.
  skip: (req) => !isAdminRealtimeStream(req),
  // Provide the handler field value.
  handler: createPolicyHandler('admin-realtime'),
});

// Create the admin upload limiter constant.
const adminUploadLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_ADMIN_UPLOAD_MAX', 20),
});

// Create the checkout limiter constant.
const checkoutLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_CHECKOUT_MAX', 20),
});

// Create the booking limiter constant.
const bookingLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_BOOKING_MAX', 30),
});

// Create the chat limiter constant.
const chatLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: readPositiveInt('RATE_LIMIT_CHAT_WINDOW_MS', 60 * 1000),
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_CHAT_MAX', 60),
});

// Public availability search prices every car on the page. Cap anonymous bursts.
const searchLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_SEARCH_MAX', 120),
  // Provide the handler field value.
  handler: createPolicyHandler('car-search'),
});

// Create the contact limiter constant.
const contactLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_CONTACT_MAX', 10),
});

// Create the account upload limiter constant.
const accountUploadLimiter = createLimiter({
  // Provide the window ms field value.
  windowMs: DEFAULT_WINDOW_MS,
  // Provide the max field value.
  max: readPositiveInt('RATE_LIMIT_ACCOUNT_UPLOAD_MAX', 20),
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  authLimiter,
  // Contribute this line to the enclosing declaration or statement.
  loginLimiter,
  // Contribute this line to the enclosing declaration or statement.
  signupLimiter,
  // Contribute this line to the enclosing declaration or statement.
  emailVerificationLimiter,
  // Contribute this line to the enclosing declaration or statement.
  adminReadLimiter,
  // Contribute this line to the enclosing declaration or statement.
  adminWriteLimiter,
  // Contribute this line to the enclosing declaration or statement.
  adminRealtimeLimiter,
  // Contribute this line to the enclosing declaration or statement.
  accountUploadLimiter,
  // Contribute this line to the enclosing declaration or statement.
  adminUploadLimiter,
  // Contribute this line to the enclosing declaration or statement.
  checkoutLimiter,
  // Contribute this line to the enclosing declaration or statement.
  bookingLimiter,
  // Contribute this line to the enclosing declaration or statement.
  chatLimiter,
  // Contribute this line to the enclosing declaration or statement.
  searchLimiter,
  // Contribute this line to the enclosing declaration or statement.
  contactLimiter,
  // Contribute this line to the enclosing declaration or statement.
  createLimiter,
  // Contribute this line to the enclosing declaration or statement.
  defaultHandler,
  // Contribute this line to the enclosing declaration or statement.
  adminRateLimitKey,
  // Contribute this line to the enclosing declaration or statement.
  isAdminRealtimeStream,
  // Contribute this line to the enclosing declaration or statement.
  isReadMethod,
};
