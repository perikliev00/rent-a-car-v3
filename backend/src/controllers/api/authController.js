/**
 * Auth API handlers: login, signup, email verification, session/CSRF, and logout.
 */
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const userSql = require('../../services/sql/userSqlService');
const rbacService = require('../../services/rbac/rbacService');
const loginAttemptService = require('../../services/auth/loginAttemptService');
const emailVerificationService = require('../../services/auth/emailVerificationService');
const { claimReservationsForUser } = require('../../services/account/accountClaimService');
const { getCsrfToken, generateCsrfToken } = require('../../middleware/csrf');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');

/**
 * Whether the user record is considered email-verified.
 * @param {{ emailVerifiedAt?: Date|string|null }|null|undefined} user
 * @returns {boolean}
 */
function isEmailVerified(user) {
  return Boolean(user?.emailVerifiedAt);
}

/**
 * Build the public session user payload including optional RBAC access.
 * @param {object} user - User row from SQL
 * @param {{ roles?: string[], permissions?: string[] }|null} [access=null]
 * @returns {{ id: *, email: *, role: *, roles: string[], permissions: string[], emailVerified: boolean }}
 */
function toUserPayload(user, access = null) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    roles: access?.roles || user.roles || [],
    permissions: access?.permissions || user.permissions || [],
    emailVerified: isEmailVerified(user),
  };
}

/**
 * Map known auth service errors to API envelope responses.
 * Side effects: may write an API error response when `err` has status/code.
 * @param {import('express').Response} res
 * @param {Error&{status?: number, code?: string}} err
 * @returns {import('express').Response|null}
 */
function respondServiceError(res, err) {
  if (err?.status && err?.code) {
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  return null;
}

/**
 * Load RBAC roles/permissions for a user id.
 * Side effects: may query RBAC tables; failures degrade to empty access.
 * @param {{ id?: number|string }|null|undefined} user
 * @returns {Promise<{ roles: string[], permissions: string[] }>}
 */
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
 * Populate session fields after successful authentication.
 * Side effects: regenerates the session, sets user/CSRF, and saves the store.
 * @param {import('express').Request} req
 * @param {object} user
 * @param {{ roles?: string[], permissions?: string[] }} access
 * @returns {Promise<void>}
 */
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
        emailVerified: isEmailVerified(user),
      };
      req.session.csrfToken = generateCsrfToken();

      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

/**
 * Promise wrapper around req.session.save.
 * Side effects: persists the current session to the store.
 * @param {import('express').Request} req
 * @returns {Promise<void>}
 */
function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Authenticate with email/password and establish a session.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.postLogin = asyncHandler(async (req, res, next) => {
  try {
    if (req.session?.isLoggedIn) {
      return apiResponse.error(res, 'ALREADY_LOGGED_IN', 'You are already logged in.', 409);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    const { email, password } = req.body;

    // Validation failed — respond before running domain logic.
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

    try {
      await claimReservationsForUser(user.id, user.email);
    } catch (claimErr) {
      logger.warn({ err: claimErr, userId: user.id }, 'Failed to claim reservations on login');
    }

    if (rbacService.isStaffAccess(access)) {
      logEvent.info('admin.login.success', {
        requestId: req.requestId,
        userId: user.id,
      });
    }

    return apiResponse.success(res, {
      user: toUserPayload(user, access),
      csrfToken: getCsrfToken(req),
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.postLogin',
      publicMessage: 'Something went wrong while logging you in. Please try again.',
    });
  }
});

/**
 * Register a new customer account (may require email verification).
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.postSignup = asyncHandler(async (req, res, next) => {
  try {
    if (req.session?.isLoggedIn) {
      return apiResponse.error(res, 'ALREADY_LOGGED_IN', 'You are already logged in.', 409);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    const { email, password } = req.body;

    // Validation failed — respond before running domain logic.
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

    try {
      await emailVerificationService.sendVerificationEmail(user);
    } catch (verifyErr) {
      logger.warn({ err: verifyErr, userId: user.id }, 'Failed to send verification email on signup');
    }

    return apiResponse.success(
      res,
      {
        user: toUserPayload(user, access),
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

/**
 * Verify email using a token and refresh session access.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.postVerifyEmail = asyncHandler(async (req, res, next) => {
  try {
    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      return apiResponse.error(
        res,
        'VALIDATION_ERROR',
        errors.array()[0].msg,
        422
      );
    }

    const user = await emailVerificationService.verifyEmailToken(req.body.token);
    const access = await loadAccessForUser(user);

    if (req.session?.isLoggedIn && String(req.session.user?.id) === String(user.id)) {
      req.session.user = {
        ...req.session.user,
        emailVerified: true,
        roles: access.roles,
        permissions: access.permissions,
      };
      await saveSession(req);
    }

    return apiResponse.success(res, {
      user: toUserPayload(user, access),
      csrfToken: getCsrfToken(req),
    });
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.postVerifyEmail',
      publicMessage: 'Something went wrong while verifying your email. Please try again.',
    });
  }
});

/**
 * Resend the email verification message for the current user.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.postResendVerification = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.session?.user?.id;
    await emailVerificationService.resendVerificationEmail(userId);
    return apiResponse.success(res, { sent: true });
  } catch (err) {
    const handled = respondServiceError(res, err);
    if (handled) return handled;
    return forwardControllerError(err, req, next, {
      context: 'api.postResendVerification',
      publicMessage: 'Something went wrong while sending the verification email. Please try again.',
    });
  }
});

/**
 * Return the session CSRF token for cookie-based clients.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getCsrf = asyncHandler(async (req, res) => {
  return apiResponse.success(res, { csrfToken: getCsrfToken(req) });
});

/**
 * Return the current session user payload (or anonymous state).
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
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
    emailVerified: isEmailVerified(dbUser),
  };

  await saveSession(req);

  return apiResponse.success(res, {
    user: toUserPayload(dbUser, access),
    csrfToken: getCsrfToken(req),
  });
});

/**
 * Destroy the current session.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.postLogout = asyncHandler(async (req, res) => {
  if (!req.session?.isLoggedIn) {
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  const sessionId = req.sessionID;
  req.session.isLoggedIn = false;
  req.session.user = null;
  try {
    const hub = require('../../modules/realtime/realtime.hub');
    // Close only this session's streams. Another device or API client for the
    // same user keeps its stream until that session ends or access is revoked.
    if (sessionId) hub.revokeSession(sessionId);
  } catch (err) {
    logger.warn({ err, correlationId: req.correlationId }, 'Failed to close realtime streams on logout');
  }

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
