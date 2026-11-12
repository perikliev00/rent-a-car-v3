/**
 * Auth API handlers: login, signup, email verification, session/CSRF, and logout.
 */
const { validationResult } = require('express-validator');
// Require the 'bcrypt' module as bcrypt.
const bcrypt = require('bcrypt');
// Require the '../../services/sql/userSqlService' module as userSql.
const userSql = require('../../services/sql/userSqlService');
// Require the '../../services/rbac/rbacService' module as rbacService.
const rbacService = require('../../services/rbac/rbacService');
// Require the '../../services/auth/loginAttemptService' module as loginAttemptService.
const loginAttemptService = require('../../services/auth/loginAttemptService');
// Require the '../../services/auth/emailVerificationService' module as emailVerificationService.
const emailVerificationService = require('../../services/auth/emailVerificationService');
// Destructure object properties into local variables.
const { claimReservationsForUser } = require('../../services/account/accountClaimService');
// Destructure object properties into local variables.
const { getCsrfToken, generateCsrfToken } = require('../../middleware/csrf');
// Require the '../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../utils/apiResponse');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../utils/controllerError');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Require the '../../monitoring/logEvent' module as logEvent.
const logEvent = require('../../monitoring/logEvent');

/**
 * Whether the user record is considered email-verified.
 * @param {{ emailVerifiedAt?: Date|string|null }|null|undefined} user
 * @returns {boolean}
 */
function isEmailVerified(user) {
  // Return the resulting value to the caller.
  return Boolean(user?.emailVerifiedAt);
}

/**
 * Build the public session user payload including optional RBAC access.
 * @param {object} user - User row from SQL
 * @param {{ roles?: string[], permissions?: string[] }|null} [access=null]
 * @returns {{ id: *, email: *, role: *, roles: string[], permissions: string[], emailVerified: boolean }}
 */
function toUserPayload(user, access = null) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: user.id,
    // Provide the email field value.
    email: user.email,
    // Provide the role field value.
    role: user.role,
    // Provide the roles field value.
    roles: access?.roles || user.roles || [],
    // Provide the permissions field value.
    permissions: access?.permissions || user.permissions || [],
    // Provide the email verified field value.
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
  // Evaluate the condition and enter the branch when it is true.
  if (err?.status && err?.code) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  // Return the resulting value to the caller.
  return null;
}

/**
 * Load RBAC roles/permissions for a user id.
 * Side effects: may query RBAC tables; failures degrade to empty access.
 * @param {{ id?: number|string }|null|undefined} user
 * @returns {Promise<{ roles: string[], permissions: string[] }>}
 */
async function loadAccessForUser(user) {
  // Evaluate the condition and enter the branch when it is true.
  if (!user?.id) {
    // Return the resulting value to the caller.
    return { roles: [], permissions: [] };
  }
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return await rbacService.getUserAccess(user.id);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.warn to perform this step.
    logger.warn({ err, userId: user.id }, 'Failed to load RBAC access');
    // Return the resulting value to the caller.
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
  // Return the resulting value to the caller.
  return new Promise((resolve, reject) => {
    // Call req.session.regenerate to perform this step.
    req.session.regenerate((err) => {
      // Evaluate the condition and enter the branch when it is true.
      if (err) return reject(err);

      // Update req.session.isLoggedIn with the right-hand side value.
      req.session.isLoggedIn = true;
      // Update req.session.user with the right-hand side value.
      req.session.user = {
        // Provide the id field value.
        id: user.id,
        // Provide the email field value.
        email: user.email,
        // Provide the role field value.
        role: user.role,
        // Provide the roles field value.
        roles: access?.roles || [],
        // Provide the permissions field value.
        permissions: access?.permissions || [],
        // Provide the email verified field value.
        emailVerified: isEmailVerified(user),
      };
      // Update req.session.csrfToken with the right-hand side value.
      req.session.csrfToken = generateCsrfToken();

      // Call req.session.save to perform this step.
      req.session.save((saveErr) => {
        // Evaluate the condition and enter the branch when it is true.
        if (saveErr) return reject(saveErr);
        // Call resolve to perform this step.
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
  // Return the resulting value to the caller.
  return new Promise((resolve, reject) => {
    // Call req.session.save to perform this step.
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
  // Start a try block for operations that may fail.
  try {
    // Evaluate the condition and enter the branch when it is true.
    if (req.session?.isLoggedIn) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'ALREADY_LOGGED_IN', 'You are already logged in.', 409);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Destructure object properties into local variables.
    const { email, password } = req.body;

    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'VALIDATION_ERROR',
        // Call errors.array to perform this step.
        errors.array()[0].msg,
        // Supply the literal value used by the enclosing expression.
        422
      );
    }

    // Create the user constant.
    const user = await userSql.findUserByEmail(email);
    // Evaluate the condition and enter the branch when it is true.
    if (!user) {
      // Call loginAttemptService.recordFailure to perform this step.
      loginAttemptService.recordFailure(email, {
        // Provide the ip field value.
        ip: req.ip,
        // Provide the request id field value.
        requestId: req.requestId,
        // Provide the role field value.
        role: 'unknown',
      });
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'INVALID_CREDENTIALS', 'Invalid email or password.', 401, req);
    }

    // Create the password matches constant.
    const passwordMatches = await bcrypt.compare(password, user.password);
    // Evaluate the condition and enter the branch when it is true.
    if (!passwordMatches) {
      // Call loginAttemptService.recordFailure to perform this step.
      loginAttemptService.recordFailure(email, {
        // Provide the ip field value.
        ip: req.ip,
        // Provide the request id field value.
        requestId: req.requestId,
        // Provide the role field value.
        role: user.role,
      });
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'INVALID_CREDENTIALS', 'Invalid email or password.', 401, req);
    }

    // Call loginAttemptService.clearAttempts to perform this step.
    loginAttemptService.clearAttempts(email);
    // Create the access constant.
    const access = await loadAccessForUser(user);
    // Wait until the asynchronous operation resolves.
    await establishUserSession(req, user, access);

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await claimReservationsForUser(user.id, user.email);
    // Continue the surrounding logic with this statement.
    } catch (claimErr) {
      // Call logger.warn to perform this step.
      logger.warn({ err: claimErr, userId: user.id }, 'Failed to claim reservations on login');
    }

    // Evaluate the condition and enter the branch when it is true.
    if (rbacService.isStaffAccess(access)) {
      // Call logEvent.info to perform this step.
      logEvent.info('admin.login.success', {
        // Provide the request id field value.
        requestId: req.requestId,
        // Provide the user id field value.
        userId: user.id,
      });
    }

    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Provide the user field value.
      user: toUserPayload(user, access),
      // Provide the csrf token field value.
      csrfToken: getCsrfToken(req),
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.postLogin',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Evaluate the condition and enter the branch when it is true.
    if (req.session?.isLoggedIn) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'ALREADY_LOGGED_IN', 'You are already logged in.', 409);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Destructure object properties into local variables.
    const { email, password } = req.body;

    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'VALIDATION_ERROR',
        // Call errors.array to perform this step.
        errors.array()[0].msg,
        // Supply the literal value used by the enclosing expression.
        422
      );
    }

    // Create the existing user constant.
    const existingUser = await userSql.findUserByEmail(email);
    // Evaluate the condition and enter the branch when it is true.
    if (existingUser) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'EMAIL_IN_USE', 'Email is already in use.', 409);
    }

    // Create the hashed password constant.
    const hashedPassword = await bcrypt.hash(password, 10);

    // Reserve the user variable for later assignment.
    let user;
    // Start a try block for operations that may fail.
    try {
      // Store the awaited result in user.
      user = await userSql.createUser({
        // Contribute this line to the enclosing declaration or statement.
        email,
        // Provide the password field value.
        password: hashedPassword,
      });
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Evaluate the condition and enter the branch when it is true.
      if (err.code === 'EMAIL_IN_USE') {
        // Return the resulting value to the caller.
        return apiResponse.error(res, 'EMAIL_IN_USE', 'Email is already in use.', 409);
      }
      // Throw an error to stop the current control flow.
      throw err;
    }

    // Create the access constant.
    const access = await loadAccessForUser(user);
    // Wait until the asynchronous operation resolves.
    await establishUserSession(req, user, access);

    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await emailVerificationService.sendVerificationEmail(user);
    // Continue the surrounding logic with this statement.
    } catch (verifyErr) {
      // Call logger.warn to perform this step.
      logger.warn({ err: verifyErr, userId: user.id }, 'Failed to send verification email on signup');
    }

    // Return the resulting value to the caller.
    return apiResponse.success(
      // Contribute this line to the enclosing declaration or statement.
      res,
      {
        // Provide the user field value.
        user: toUserPayload(user, access),
        // Provide the csrf token field value.
        csrfToken: getCsrfToken(req),
      },
      // Supply the literal value used by the enclosing expression.
      201
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.postSignup',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'VALIDATION_ERROR',
        // Call errors.array to perform this step.
        errors.array()[0].msg,
        // Supply the literal value used by the enclosing expression.
        422
      );
    }

    // Create the user constant.
    const user = await emailVerificationService.verifyEmailToken(req.body.token);
    // Create the access constant.
    const access = await loadAccessForUser(user);

    // Evaluate the condition and enter the branch when it is true.
    if (req.session?.isLoggedIn && String(req.session.user?.id) === String(user.id)) {
      // Update req.session.user with the right-hand side value.
      req.session.user = {
        // Spread req.session.user into the surrounding structure.
        ...req.session.user,
        // Provide the email verified field value.
        emailVerified: true,
        // Provide the roles field value.
        roles: access.roles,
        // Provide the permissions field value.
        permissions: access.permissions,
      };
      // Wait until the asynchronous operation resolves.
      await saveSession(req);
    }

    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Provide the user field value.
      user: toUserPayload(user, access),
      // Provide the csrf token field value.
      csrfToken: getCsrfToken(req),
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.postVerifyEmail',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the user id constant.
    const userId = req.session?.user?.id;
    // Wait until the asynchronous operation resolves.
    await emailVerificationService.resendVerificationEmail(userId);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { sent: true });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the handled constant.
    const handled = respondServiceError(res, err);
    // Evaluate the condition and enter the branch when it is true.
    if (handled) return handled;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.postResendVerification',
      // Provide the public message field value.
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
  // Return the resulting value to the caller.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!req.session?.isLoggedIn || !req.session?.user) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  // Create the session user constant.
  const sessionUser = req.session.user;
  // Create the db user constant.
  const dbUser = await userSql.findUserById(sessionUser.id);
  // Evaluate the condition and enter the branch when it is true.
  if (!dbUser) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  // Create the access constant.
  const access = await loadAccessForUser(dbUser);
  // Update req.session.user with the right-hand side value.
  req.session.user = {
    // Provide the id field value.
    id: dbUser.id,
    // Provide the email field value.
    email: dbUser.email,
    // Provide the role field value.
    role: dbUser.role,
    // Provide the roles field value.
    roles: access.roles,
    // Provide the permissions field value.
    permissions: access.permissions,
    // Provide the email verified field value.
    emailVerified: isEmailVerified(dbUser),
  };

  // Wait until the asynchronous operation resolves.
  await saveSession(req);

  // Return the resulting value to the caller.
  return apiResponse.success(res, {
    // Provide the user field value.
    user: toUserPayload(dbUser, access),
    // Provide the csrf token field value.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!req.session?.isLoggedIn) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  // Create the session id constant.
  const sessionId = req.sessionID;
  // Update req.session.isLoggedIn with the right-hand side value.
  req.session.isLoggedIn = false;
  // Update req.session.user with the right-hand side value.
  req.session.user = null;
  // Start a try block for operations that may fail.
  try {
    // Require the '../../modules/realtime/realtime.hub' module as hub.
    const hub = require('../../modules/realtime/realtime.hub');
    // Close only this session's streams. Another device or API client for the
    // same user keeps its stream until that session ends or access is revoked.
    if (sessionId) hub.revokeSession(sessionId);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.warn to perform this step.
    logger.warn({ err, correlationId: req.correlationId }, 'Failed to close realtime streams on logout');
  }

  // Return the resulting value to the caller.
  return new Promise((resolve) => {
    // Call req.session.destroy to perform this step.
    req.session.destroy((err) => {
      // Evaluate the condition and enter the branch when it is true.
      if (err) {
        // Call logger.warn to perform this step.
        logger.warn(
          // Contribute this line to the enclosing declaration or statement.
          { err, correlationId: req.correlationId },
          // Supply the literal value used by the enclosing expression.
          'Session destroy error during API logout'
        );
      }
      // Call resolve to perform this step.
      resolve(apiResponse.success(res, { loggedOut: true }));
    });
  });
});
