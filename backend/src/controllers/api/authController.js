const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const userSql = require('../../services/sql/userSqlService');
const rbacService = require('../../services/rbac/rbacService');
const loginAttemptService = require('../../services/auth/loginAttemptService');
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

    // Login must never assign guest booking ownership from an email match alone.

    if (rbacService.isStaffAccess(access, user.role)) {
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

    // Signup must never assign guest booking ownership from an email match alone.

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
  };

  await new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

  return apiResponse.success(res, {
    user: toUserPayload(dbUser, access),
    csrfToken: getCsrfToken(req),
  });
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
