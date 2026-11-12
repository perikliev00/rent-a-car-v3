const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

jest.mock('../../src/services/reservationService', () => ({}));
jest.mock('../../src/middleware/rateLimit', () =>
  require('../helpers/rateLimitPassthrough')
);
jest.mock('../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  createUser: jest.fn(),
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
jest.mock('../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
jest.mock('../../src/services/auth/emailVerificationService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ sent: false }),
  verifyEmailToken: jest.fn(),
  resendVerificationEmail: jest.fn().mockResolvedValue({ sent: true }),
  hashEmailVerificationToken: jest.fn((token) => token),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const userSql = require('../../src/services/sql/userSqlService');
const loginAttemptService = require('../../src/services/auth/loginAttemptService');
const { claimReservationsForUser } = require('../../src/services/account/accountClaimService');
const emailVerificationService = require('../../src/services/auth/emailVerificationService');

const mockUser = {
  id: 42,
  email: 'user@example.com',
  password: 'hashed-password',
  role: 'customer',
};

const emptyAccessUser = {
  id: 42,
  email: 'user@example.com',
  role: 'customer',
  roles: [],
  permissions: [],
  emailVerified: false,
};

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claimReservationsForUser.mockResolvedValue({ reservations: 0, orders: 0 });
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
        csrfToken: expect.any(String),
      },
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('Secret123', 'hashed-password');
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userSql.findUserByEmail.mockResolvedValue(null);
    userSql.createUser.mockResolvedValue(newUser);
    bcrypt.hash.mockResolvedValue('hashed-new-password');
  });

  test('creates user and returns 201', async () => {
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
        csrfToken: expect.any(String),
      },
    });
    expect(bcrypt.hash).toHaveBeenCalledWith('Secret123', 10);
    expect(userSql.createUser).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'hashed-new-password',
    });
    expect(claimReservationsForUser).not.toHaveBeenCalled();
    expect(emailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(newUser);
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
  const verifiedUser = {
    id: 99,
    email: 'new@example.com',
    role: 'customer',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    emailVerificationService.verifyEmailToken.mockResolvedValue(verifiedUser);
  });

  test('verifies email with a valid token', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);
    const token = 'a'.repeat(64);

    const response = await withCsrf(agent, agent.post('/api/auth/verify-email'))
      .send({ token })
      .expect(200);

    expect(emailVerificationService.verifyEmailToken).toHaveBeenCalledWith(token);
    expect(response.body.data.user).toEqual({
      id: 99,
      email: 'new@example.com',
      role: 'customer',
      roles: [],
      permissions: [],
      emailVerified: true,
    });
  });

  test('returns 400 when the token is invalid', async () => {
    const err = new Error('This verification link is invalid or has expired.');
    err.code = 'INVALID_TOKEN';
    err.status = 400;
    emailVerificationService.verifyEmailToken.mockRejectedValue(err);

    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/verify-email'))
      .send({ token: 'b'.repeat(64) })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loginAttemptService.resetForTests();
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    userSql.findUserById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    emailVerificationService.resendVerificationEmail.mockResolvedValue({ sent: true });
  });

  test('returns unauthorized when not logged in', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const response = await withCsrf(agent, agent.post('/api/auth/resend-verification')).expect(
      401
    );
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(emailVerificationService.resendVerificationEmail).not.toHaveBeenCalled();
  });

  test('resends verification for the authenticated user', async () => {
    const app = createApiTestApp();
    const agent = await initTestAgent(app);

    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);
    agent.csrfToken = loginRes.body.data.csrfToken;

    const response = await withCsrf(agent, agent.post('/api/auth/resend-verification')).expect(
      200
    );

    expect(response.body.data.sent).toBe(true);
    expect(emailVerificationService.resendVerificationEmail).toHaveBeenCalledWith(42);
  });
});
