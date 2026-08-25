const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

jest.mock('../../src/services/reservationService', () => ({}));
jest.mock('../../src/middleware/rateLimit', () =>
  require('../helpers/rateLimitPassthrough')()
);
jest.mock('../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  createUser: jest.fn(),
  markEmailVerified: jest.fn(),
}));
jest.mock('../../src/services/rbac/rbacService', () => {
  const actual = jest.requireActual('../../src/services/rbac/rbacService');
  return {
    ...actual,
    getUserAccess: jest.fn().mockResolvedValue({
      roles: [],
      permissions: [],
      roleDetails: [],
    }),
  };
});
jest.mock('../../src/services/auth/emailVerificationService', () => {
  const actual = jest.requireActual('../../src/services/auth/emailVerificationService');
  return {
    OUTCOMES: actual.OUTCOMES,
    issueAndSendVerification: jest.fn().mockResolvedValue({ sent: true }),
    verifyToken: jest.fn(),
    resendVerification: jest.fn().mockResolvedValue({ status: 'sent' }),
  };
});
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const userSql = require('../../src/services/sql/userSqlService');
const loginAttemptService = require('../../src/services/auth/loginAttemptService');
const emailVerificationService = require('../../src/services/auth/emailVerificationService');
const { OUTCOMES } = emailVerificationService;

const VALID_TOKEN = 'a'.repeat(64);

const mockUser = {
  id: 42,
  email: 'user@example.com',
  password: 'hashed-password',
  role: 'customer',
  emailVerified: true,
};

const emptyAccessUser = {
  id: 42,
  email: 'user@example.com',
  role: 'customer',
  roles: [],
  permissions: [],
  emailVerified: true,
};

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emailVerificationService.issueAndSendVerification.mockResolvedValue({ sent: true });
    loginAttemptService.resetForTests();
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    userSql.findUserById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
  });

  test('returns user on successful login', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        user: emptyAccessUser,
        verificationRequired: false,
        csrfToken: expect.any(String),
      },
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('Secret123', 'hashed-password');
  });

  test('login of an unverified account reports verificationRequired and sends a link', async () => {
    userSql.findUserByEmail.mockResolvedValue({ ...mockUser, emailVerified: false });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);

    expect(response.body.data.verificationRequired).toBe(true);
    expect(response.body.data.user.emailVerified).toBe(false);
    expect(emailVerificationService.issueAndSendVerification).toHaveBeenCalledTimes(1);
  });

  test('returns validation error for invalid email', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'not-an-email', password: 'Secret123' })
      .expect(422);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please enter a valid email address',
      },
    });
  });

  test('returns invalid credentials for unknown user', async () => {
    userSql.findUserByEmail.mockResolvedValue(null);
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'missing@example.com', password: 'Secret123' })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('returns invalid credentials for wrong password', async () => {
    bcrypt.compare.mockResolvedValue(false);
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'wrong' })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('returns rate limited when account is locked', async () => {
    for (let i = 0; i < loginAttemptService.MAX_ATTEMPTS; i += 1) {
      loginAttemptService.recordFailure('user@example.com');
    }
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(429);

    expect(response.body.error.code).toBe('RATE_LIMITED');
    expect(userSql.findUserByEmail).not.toHaveBeenCalled();
  });

  test('returns conflict when already logged in', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);
    agent.csrfToken = loginRes.body.data.csrfToken;

    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(409);

    expect(response.body.error.code).toBe('ALREADY_LOGGED_IN');
  });
});

describe('POST /api/auth/signup', () => {
  const newUser = {
    id: 99,
    email: 'new@example.com',
    role: 'customer',
    emailVerified: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    emailVerificationService.issueAndSendVerification.mockResolvedValue({ sent: true });
    userSql.findUserByEmail.mockResolvedValue(null);
    userSql.createUser.mockResolvedValue(newUser);
    bcrypt.hash.mockResolvedValue('hashed-new-password');
  });

  test('creates an unverified user and returns 201', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/signup'))
      .send({ email: 'new@example.com', password: 'Secret123' })
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      data: {
        user: {
          id: 99,
          email: 'new@example.com',
          role: 'customer',
          roles: [],
          permissions: [],
          emailVerified: false,
        },
        verificationRequired: true,
        csrfToken: expect.any(String),
      },
    });
    expect(bcrypt.hash).toHaveBeenCalledWith('Secret123', 10);
    expect(userSql.createUser).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'hashed-new-password',
    });
  });

  test('signup sends a verification email', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    await withCsrf(agent, agent.post('/api/auth/signup'))
      .send({ email: 'new@example.com', password: 'Secret123' })
      .expect(201);

    expect(emailVerificationService.issueAndSendVerification).toHaveBeenCalledWith(newUser);
  });

  test('signup still succeeds when the verification email cannot be sent', async () => {
    emailVerificationService.issueAndSendVerification.mockRejectedValue(new Error('smtp down'));
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/signup'))
      .send({ email: 'new@example.com', password: 'Secret123' })
      .expect(201);

    // A mail failure must never produce a verified-looking account.
    expect(response.body.data.user.emailVerified).toBe(false);
    expect(response.body.data.verificationRequired).toBe(true);
  });

  test('returns validation error for weak password', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/signup'))
      .send({ email: 'new@example.com', password: 'short' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(userSql.createUser).not.toHaveBeenCalled();
  });

  test('returns conflict when email is already in use', async () => {
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/signup'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_IN_USE');
    expect(userSql.createUser).not.toHaveBeenCalled();
  });

  test('returns conflict when already logged in', async () => {
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    loginAttemptService.resetForTests();
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);
    agent.csrfToken = loginRes.body.data.csrfToken;

    const response = await withCsrf(agent, agent.post('/api/auth/signup'))
      .send({ email: 'other@example.com', password: 'Secret123' })
      .expect(409);

    expect(response.body.error.code).toBe('ALREADY_LOGGED_IN');
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loginAttemptService.resetForTests();
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
  });

  test('logs out authenticated user', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);
    agent.csrfToken = loginRes.body.data.csrfToken;

    const response = await withCsrf(agent, agent.post('/api/auth/logout')).expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { loggedOut: true },
    });

    const loginAgent = await initTestAgent(app);
    const reloginRes = await withCsrf(loginAgent, loginAgent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);

    expect(reloginRes.body.success).toBe(true);
  });

  test('returns unauthorized when not logged in', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/logout')).expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loginAttemptService.resetForTests();
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    userSql.findUserById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
  });

  test('returns current user when logged in', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);
    agent.csrfToken = loginRes.body.data.csrfToken;

    const response = await agent.get('/api/auth/me').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        user: emptyAccessUser,
        verificationRequired: false,
        csrfToken: expect.any(String),
      },
    });
  });

  test('returns unauthorized when not logged in', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/auth/me').expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/auth/verify-email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loginAttemptService.resetForTests();
  });

  test('confirms the email for a valid token', async () => {
    emailVerificationService.verifyToken.mockResolvedValue({
      outcome: OUTCOMES.VERIFIED,
      user: { id: 42 },
    });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/verify-email'))
      .send({ token: VALID_TOKEN })
      .expect(200);

    expect(response.body.data).toEqual({ emailVerified: true, alreadyVerified: false });
  });

  test('is idempotent for an already verified account', async () => {
    emailVerificationService.verifyToken.mockResolvedValue({
      outcome: OUTCOMES.ALREADY_VERIFIED,
      user: { id: 42 },
    });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/verify-email'))
      .send({ token: VALID_TOKEN })
      .expect(200);

    expect(response.body.data).toEqual({ emailVerified: true, alreadyVerified: true });
  });

  test('returns 410 for an expired token', async () => {
    emailVerificationService.verifyToken.mockResolvedValue({ outcome: OUTCOMES.EXPIRED });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/verify-email'))
      .send({ token: VALID_TOKEN })
      .expect(410);

    expect(response.body.error.code).toBe('VERIFICATION_TOKEN_EXPIRED');
  });

  test.each([
    ['invalid', OUTCOMES.INVALID],
    ['used', OUTCOMES.USED],
    ['revoked', OUTCOMES.REVOKED],
  ])('returns an indistinguishable error for a %s token', async (_label, outcome) => {
    emailVerificationService.verifyToken.mockResolvedValue({ outcome });
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/verify-email'))
      .send({ token: VALID_TOKEN })
      .expect(400);

    expect(response.body.error.code).toBe('VERIFICATION_TOKEN_INVALID');
  });

  test('rejects a malformed token before touching the service', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/verify-email'))
      .send({ token: 'not-a-token' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(emailVerificationService.verifyToken).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/verify-email/resend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loginAttemptService.resetForTests();
    userSql.findUserByEmail.mockResolvedValue({ ...mockUser, emailVerified: false });
    userSql.findUserById.mockResolvedValue({ ...mockUser, emailVerified: false });
    bcrypt.compare.mockResolvedValue(true);
    emailVerificationService.issueAndSendVerification.mockResolvedValue({ sent: true });
    emailVerificationService.resendVerification.mockResolvedValue({ status: 'sent' });
  });

  test('requires authentication', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(
      agent,
      agent.post('/api/auth/verify-email/resend')
    ).expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  test('returns the same response whether the mail was sent or throttled', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);
    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);
    agent.csrfToken = loginRes.body.data.csrfToken;

    const sent = await withCsrf(agent, agent.post('/api/auth/verify-email/resend')).expect(200);

    emailVerificationService.resendVerification.mockResolvedValue({ status: 'throttled' });
    const throttled = await withCsrf(
      agent,
      agent.post('/api/auth/verify-email/resend')
    ).expect(200);

    expect(sent.body).toEqual(throttled.body);
    expect(sent.body.data).toEqual({ requested: true, emailVerified: false });
  });
});
