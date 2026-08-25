const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const userSql = require('../../services/sql/userSqlService');
const rbacService = require('../../services/rbac/rbacService');
const loginAttemptService = require('../../services/auth/loginAttemptService');
const emailVerificationService = require('../../services/auth/emailVerificationService');
const { getCsrfToken, generateCsrfToken } = require('../../middleware/csrf');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');
const metrics = require('../../monitoring/metrics');

function toUserPayload(user, access = null) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    roles: access?.roles || user.roles || [],
    permissions: access?.permissions || user.permissions || [],
    emailVerified: Boolean(user.emailVerified),
  };
}

async function loadAccessForUser(user) {
  if (!user?.id) {
    return { roles: [], permissions: [] };
  }
  try {
    return await rbacService.getUserAccess(user.id);
  } catch (err) {
    logger.warn({ err, userId: user.id }, 'Failed to load RBAC access');
    return { roles: [], permissions: [] };
  }
}

/**
 * Verification mail is best-effort. A failure must not fail the request nor leave the
 * account looking verified — the account simply stays unverified and can resend.
 */
async function sendVerificationSafely(user) {
  try {
    await emailVerificationService.issueAndSendVerification(user);
  } catch (err) {
    logger.warn({ err, userId: user.id }, 'Failed to send verification email');
  }
}

function establishUserSession(req, user, access) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);

      req.session.isLoggedIn = true;
      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        roles: access?.roles || [],
        permissions: access?.permissions || [],
        // An unverified session is intentionally limited: it authenticates the person
        // but is refused by every /api/account route until the email is confirmed.
        emailVerified: Boolean(user.emailVerified),
      };
      req.session.csrfToken = generateCsrfToken();

      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

exports.postLogin = asyncHandler(async (req, res, next) => {
  try {
    if (req.session?.isLoggedIn) {
      return apiResponse.error(res, 'ALREADY_LOGGED_IN', 'You are already logged in.', 409);
    }

    const errors = validationResult(req);
    const { email, password } = req.body;

    if (!errors.isEmpty()) {
      return apiResponse.error(
        res,
        'VALIDATION_ERROR',
        errors.array()[0].msg,
        422
      );
    }

    const user = await userSql.findUserByEmail(email);
    if (!user) {
      loginAttemptService.recordFailure(email, {
        ip: req.ip,
        requestId: req.requestId,
        role: 'unknown',
      });
      return apiResponse.error(res, 'INVALID_CREDENTIALS', 'Invalid email or password.', 401, req);
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      loginAttemptService.recordFailure(email, {
        ip: req.ip,
        requestId: req.requestId,
        role: user.role,
      });
      return apiResponse.error(res, 'INVALID_CREDENTIALS', 'Invalid email or password.', 401, req);
    }

    loginAttemptService.clearAttempts(email);
    const access = await loadAccessForUser(user);
    await establishUserSession(req, user, access);

    // Login never assigns ownership of reservations or orders. Guest bookings are linked
    // only through the explicit, token-based claim flow.
    if (!user.emailVerified) {
      // Legacy accounts created before verification existed get a fresh link on login.
      await sendVerificationSafely(user);
    }

    if (rbacService.isStaffAccess(access, user.role)) {
      logEvent.info('admin.login.success', {
        requestId: req.requestId,
        userId: user.id,
      });
    }

    return apiResponse.success(res, {
      user: toUserPayload(user, access),
      verificationRequired: !user.emailVerified,
      csrfToken: getCsrfToken(req),
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.postLogin',
      publicMessage: 'Something went wrong while logging you in. Please try again.',
    });
  }
});

exports.postSignup = asyncHandler(async (req, res, next) => {
  try {
    if (req.session?.isLoggedIn) {
      return apiResponse.error(res, 'ALREADY_LOGGED_IN', 'You are already logged in.', 409);
    }

    const errors = validationResult(req);
    const { email, password } = req.body;

    if (!errors.isEmpty()) {
      return apiResponse.error(
        res,
        'VALIDATION_ERROR',
        errors.array()[0].msg,
        422
      );
    }

    const existingUser = await userSql.findUserByEmail(email);
    if (existingUser) {
      return apiResponse.error(res, 'EMAIL_IN_USE', 'Email is already in use.', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await userSql.createUser({
        email,
        password: hashedPassword,
      });
    } catch (err) {
      if (err.code === 'EMAIL_IN_USE') {
        return apiResponse.error(res, 'EMAIL_IN_USE', 'Email is already in use.', 409);
      }
      throw err;
    }

    const access = await loadAccessForUser(user);
    await establishUserSession(req, user, access);

    // Signup never assigns ownership of reservations or orders. Knowing an email address
    // grants nothing; only a claim token mailed to that address does.
    await sendVerificationSafely(user);

    return apiResponse.success(
      res,
      {
        user: toUserPayload(user, access),
        verificationRequired: !user.emailVerified,
        csrfToken: getCsrfToken(req),
      },
      201
    );
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.postSignup',
      publicMessage: 'Something went wrong while signing you up. Please try again.',
    });
  }
});

exports.getCsrf = asyncHandler(async (req, res) => {
  return apiResponse.success(res, { csrfToken: getCsrfToken(req) });
});

exports.getMe = asyncHandler(async (req, res) => {
  if (!req.session?.isLoggedIn || !req.session?.user) {
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  const sessionUser = req.session.user;
  const dbUser = await userSql.findUserById(sessionUser.id);
  if (!dbUser) {
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  const access = await loadAccessForUser(dbUser);
  req.session.user = {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    roles: access.roles,
    permissions: access.permissions,
    emailVerified: Boolean(dbUser.emailVerified),
  };

  await new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

  return apiResponse.success(res, {
    user: toUserPayload(dbUser, access),
    verificationRequired: !dbUser.emailVerified,
    csrfToken: getCsrfToken(req),
  });
});

const { OUTCOMES } = emailVerificationService;

exports.postVerifyEmail = asyncHandler(async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, 'VALIDATION_ERROR', errors.array()[0].msg, 422);
    }

    const result = await emailVerificationService.verifyToken(req.body.token);

    if (
      result.outcome === OUTCOMES.VERIFIED ||
      result.outcome === OUTCOMES.ALREADY_VERIFIED
    ) {
      // Refresh the live session so the caller immediately gains portal access without
      // logging out, but only when the verified account is the one already signed in.
      if (
        req.session?.isLoggedIn &&
        req.session.user &&
        String(req.session.user.id) === String(result.user.id)
      ) {
        req.session.user.emailVerified = true;
        await new Promise((resolve, reject) => {
          req.session.save((err) => (err ? reject(err) : resolve()));
        });
      }

      return apiResponse.success(res, {
        emailVerified: true,
        alreadyVerified: result.outcome === OUTCOMES.ALREADY_VERIFIED,
      });
    }

    if (result.outcome === OUTCOMES.EXPIRED) {
      return apiResponse.error(
        res,
        'VERIFICATION_TOKEN_EXPIRED',
        'This confirmation link has expired. Request a new one.',
        410
      );
    }

    // Invalid, used and revoked collapse into one response so a caller cannot probe which
    // tokens ever existed.
    return apiResponse.error(
      res,
      'VERIFICATION_TOKEN_INVALID',
      'This confirmation link is not valid. Request a new one.',
      400
    );
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.postVerifyEmail',
      publicMessage: 'Something went wrong while confirming your email. Please try again.',
    });
  }
});

exports.postResendVerification = asyncHandler(async (req, res, next) => {
  try {
    if (!req.session?.isLoggedIn || !req.session?.user) {
      return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
    }

    const user = await userSql.findUserById(req.session.user.id);
    if (!user) {
      return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
    }

    const result = await emailVerificationService.resendVerification(user);

    // Deliberately uniform: throttled, sent and already-verified are indistinguishable so
    // the endpoint cannot be used to probe account state.
    return apiResponse.success(res, {
      requested: true,
      emailVerified: result.status === 'already_verified',
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.postResendVerification',
      publicMessage: 'Something went wrong while sending your confirmation email.',
    });
  }
});

exports.postLogout = asyncHandler(async (req, res) => {
  if (!req.session?.isLoggedIn) {
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  req.session.isLoggedIn = false;
  req.session.user = null;

  return new Promise((resolve) => {
    req.session.destroy((err) => {
      if (err) {
        logger.warn(
          { err, correlationId: req.correlationId },
          'Session destroy error during API logout'
        );
      }
      resolve(apiResponse.success(res, { loggedOut: true }));
    });
  });
});
