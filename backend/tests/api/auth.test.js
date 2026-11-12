// Require the 'supertest' module as request.
const request = require('supertest');
// Require the 'bcrypt' module as bcrypt.
const bcrypt = require('bcrypt');
// Destructure object properties into local variables.
const { createApiTestApp, initTestAgent, withCsrf } = require('../helpers/apiTestApp');

// Call jest.mock to perform this step.
jest.mock('../../src/services/reservationService', () => ({}));
// Call jest.mock to perform this step.
jest.mock('../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../helpers/rateLimitPassthrough')
);
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/userSqlService', () => ({
  // Provide the find user by email field value.
  findUserByEmail: jest.fn(),
  // Provide the find user by id field value.
  findUserById: jest.fn(),
  // Provide the create user field value.
  createUser: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/rbac/rbacService', () => {
  // Create the actual constant.
  const actual = jest.requireActual('../../src/services/rbac/rbacService');
  // Return the resulting value to the caller.
  return {
    // Spread actual into the surrounding structure.
    ...actual,
    // Provide the get user access field value.
    getUserAccess: jest.fn().mockResolvedValue({
      // Provide the roles field value.
      roles: [],
      // Provide the permissions field value.
      permissions: [],
      // Provide the role details field value.
      roleDetails: [],
    }),
  };
});
// Call jest.mock to perform this step.
jest.mock('../../src/services/account/accountClaimService', () => ({
  // Provide the claim reservations for user field value.
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/services/auth/emailVerificationService', () => ({
  // Provide the send verification email field value.
  sendVerificationEmail: jest.fn().mockResolvedValue({ sent: false }),
  // Provide the verify email token field value.
  verifyEmailToken: jest.fn(),
  // Provide the resend verification email field value.
  resendVerificationEmail: jest.fn().mockResolvedValue({ sent: true }),
  // Provide the hash email verification token field value.
  hashEmailVerificationToken: jest.fn((token) => token),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../src/services/sql/userSqlService' module as userSql.
const userSql = require('../../src/services/sql/userSqlService');
// Require the '../../src/services/auth/loginAttemptService' module as loginAttemptService.
const loginAttemptService = require('../../src/services/auth/loginAttemptService');
// Destructure object properties into local variables.
const { claimReservationsForUser } = require('../../src/services/account/accountClaimService');
// Require the '../../src/services/auth/emailVerificationService' module as emailVerificationService.
const emailVerificationService = require('../../src/services/auth/emailVerificationService');

// Create the mock user constant.
const mockUser = {
  // Provide the id field value.
  id: 42,
  // Provide the email field value.
  email: 'user@example.com',
  // Provide the password field value.
  password: 'hashed-password',
  // Provide the role field value.
  role: 'customer',
};

// Create the empty access user constant.
const emptyAccessUser = {
  // Provide the id field value.
  id: 42,
  // Provide the email field value.
  email: 'user@example.com',
  // Provide the role field value.
  role: 'customer',
  // Provide the roles field value.
  roles: [],
  // Provide the permissions field value.
  permissions: [],
  // Provide the email verified field value.
  emailVerified: false,
};

// Declare a test suite grouping related cases.
describe('POST /api/auth/login', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call claimReservationsForUser.mockResolvedValue to perform this step.
    claimReservationsForUser.mockResolvedValue({ reservations: 0, orders: 0 });
    // Call loginAttemptService.resetForTests to perform this step.
    loginAttemptService.resetForTests();
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue(mockUser);
    // Call bcrypt.compare.mockResolvedValue to perform this step.
    bcrypt.compare.mockResolvedValue(true);
  });

  // Define a single test case and its expectations.
  test('returns user on successful login', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: {
        // Provide the user field value.
        user: emptyAccessUser,
        // Provide the csrf token field value.
        csrfToken: expect.any(String),
      },
    });
    // Assert that the value matches the intended expectation.
    expect(bcrypt.compare).toHaveBeenCalledWith('Secret123', 'hashed-password');
  });

  // Define a single test case and its expectations.
  test('returns validation error for invalid email', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'not-an-email', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'VALIDATION_ERROR',
        // Provide the message field value.
        message: 'Please enter a valid email address',
      },
    });
  });

  // Define a single test case and its expectations.
  test('returns invalid credentials for unknown user', async () => {
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue(null);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'missing@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(401);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  // Define a single test case and its expectations.
  test('returns invalid credentials for wrong password', async () => {
    // Call bcrypt.compare.mockResolvedValue to perform this step.
    bcrypt.compare.mockResolvedValue(false);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'wrong' })
      // Call .expect to perform this step.
      .expect(401);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  // Define a single test case and its expectations.
  test('returns rate limited when account is locked', async () => {
    // Iterate using the loop initializer, condition, and step.
    for (let i = 0; i < loginAttemptService.MAX_ATTEMPTS; i += 1) {
      // Call loginAttemptService.recordFailure to perform this step.
      loginAttemptService.recordFailure('user@example.com');
    }
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(429);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('RATE_LIMITED');
    // Assert that the value matches the intended expectation.
    expect(userSql.findUserByEmail).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns conflict when already logged in', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the login res constant.
    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);
    // Update agent.csrfToken with the right-hand side value.
    agent.csrfToken = loginRes.body.data.csrfToken;

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(409);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('ALREADY_LOGGED_IN');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/auth/signup', () => {
  // Create the new user constant.
  const newUser = {
    // Provide the id field value.
    id: 99,
    // Provide the email field value.
    email: 'new@example.com',
    // Provide the role field value.
    role: 'customer',
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue(null);
    // Call userSql.createUser.mockResolvedValue to perform this step.
    userSql.createUser.mockResolvedValue(newUser);
    // Call bcrypt.hash.mockResolvedValue to perform this step.
    bcrypt.hash.mockResolvedValue('hashed-new-password');
  });

  // Define a single test case and its expectations.
  test('creates user and returns 201', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/signup'))
      // Call .send to perform this step.
      .send({ email: 'new@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(201);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: {
        // Provide the user field value.
        user: {
          // Provide the id field value.
          id: 99,
          // Provide the email field value.
          email: 'new@example.com',
          // Provide the role field value.
          role: 'customer',
          // Provide the roles field value.
          roles: [],
          // Provide the permissions field value.
          permissions: [],
          // Provide the email verified field value.
          emailVerified: false,
        },
        // Provide the csrf token field value.
        csrfToken: expect.any(String),
      },
    });
    // Assert that the value matches the intended expectation.
    expect(bcrypt.hash).toHaveBeenCalledWith('Secret123', 10);
    // Assert that the value matches the intended expectation.
    expect(userSql.createUser).toHaveBeenCalledWith({
      // Provide the email field value.
      email: 'new@example.com',
      // Provide the password field value.
      password: 'hashed-new-password',
    });
    // Assert that the value matches the intended expectation.
    expect(claimReservationsForUser).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(emailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(newUser);
  });

  // Define a single test case and its expectations.
  test('returns validation error for weak password', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/signup'))
      // Call .send to perform this step.
      .send({ email: 'new@example.com', password: 'short' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(userSql.createUser).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns conflict when email is already in use', async () => {
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/signup'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(409);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('EMAIL_IN_USE');
    // Assert that the value matches the intended expectation.
    expect(userSql.createUser).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns conflict when already logged in', async () => {
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    // Call bcrypt.compare.mockResolvedValue to perform this step.
    bcrypt.compare.mockResolvedValue(true);
    // Call loginAttemptService.resetForTests to perform this step.
    loginAttemptService.resetForTests();
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the login res constant.
    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);
    // Update agent.csrfToken with the right-hand side value.
    agent.csrfToken = loginRes.body.data.csrfToken;

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/signup'))
      // Call .send to perform this step.
      .send({ email: 'other@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(409);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('ALREADY_LOGGED_IN');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/auth/logout', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call loginAttemptService.resetForTests to perform this step.
    loginAttemptService.resetForTests();
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    // Call bcrypt.compare.mockResolvedValue to perform this step.
    bcrypt.compare.mockResolvedValue(true);
  });

  // Define a single test case and its expectations.
  test('logs out authenticated user', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the login res constant.
    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);
    // Update agent.csrfToken with the right-hand side value.
    agent.csrfToken = loginRes.body.data.csrfToken;

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/logout')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: { loggedOut: true },
    });

    // Create the login agent constant.
    const loginAgent = await initTestAgent(app);
    // Create the relogin res constant.
    const reloginRes = await withCsrf(loginAgent, loginAgent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(reloginRes.body.success).toBe(true);
  });

  // Define a single test case and its expectations.
  test('returns unauthorized when not logged in', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/logout')).expect(401);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/auth/me', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call loginAttemptService.resetForTests to perform this step.
    loginAttemptService.resetForTests();
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue(mockUser);
    // Call bcrypt.compare.mockResolvedValue to perform this step.
    bcrypt.compare.mockResolvedValue(true);
  });

  // Define a single test case and its expectations.
  test('returns current user when logged in', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the login res constant.
    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);
    // Update agent.csrfToken with the right-hand side value.
    agent.csrfToken = loginRes.body.data.csrfToken;

    // Create the response constant.
    const response = await agent.get('/api/auth/me').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: {
        // Provide the user field value.
        user: emptyAccessUser,
        // Provide the csrf token field value.
        csrfToken: expect.any(String),
      },
    });
  });

  // Define a single test case and its expectations.
  test('returns unauthorized when not logged in', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/auth/me').expect(401);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/auth/verify-email', () => {
  // Create the verified user constant.
  const verifiedUser = {
    // Provide the id field value.
    id: 99,
    // Provide the email field value.
    email: 'new@example.com',
    // Provide the role field value.
    role: 'customer',
    // Provide the email verified at field value.
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call emailVerificationService.verifyEmailToken.mockResolvedValue to perform this step.
    emailVerificationService.verifyEmailToken.mockResolvedValue(verifiedUser);
  });

  // Define a single test case and its expectations.
  test('verifies email with a valid token', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);
    // Create the token constant.
    const token = 'a'.repeat(64);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/verify-email'))
      // Call .send to perform this step.
      .send({ token })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(emailVerificationService.verifyEmailToken).toHaveBeenCalledWith(token);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.user).toEqual({
      // Provide the id field value.
      id: 99,
      // Provide the email field value.
      email: 'new@example.com',
      // Provide the role field value.
      role: 'customer',
      // Provide the roles field value.
      roles: [],
      // Provide the permissions field value.
      permissions: [],
      // Provide the email verified field value.
      emailVerified: true,
    });
  });

  // Define a single test case and its expectations.
  test('returns 400 when the token is invalid', async () => {
    // Create the err constant.
    const err = new Error('This verification link is invalid or has expired.');
    // Update err.code with the right-hand side value.
    err.code = 'INVALID_TOKEN';
    // Update err.status with the right-hand side value.
    err.status = 400;
    // Call emailVerificationService.verifyEmailToken.mockRejectedValue to perform this step.
    emailVerificationService.verifyEmailToken.mockRejectedValue(err);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/verify-email'))
      // Call .send to perform this step.
      .send({ token: 'b'.repeat(64) })
      // Call .expect to perform this step.
      .expect(400);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/auth/resend-verification', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call loginAttemptService.resetForTests to perform this step.
    loginAttemptService.resetForTests();
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue(mockUser);
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue(mockUser);
    // Call bcrypt.compare.mockResolvedValue to perform this step.
    bcrypt.compare.mockResolvedValue(true);
    // Call emailVerificationService.resendVerificationEmail.mockResolvedValue to perform this step.
    emailVerificationService.resendVerificationEmail.mockResolvedValue({ sent: true });
  });

  // Define a single test case and its expectations.
  test('returns unauthorized when not logged in', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/resend-verification')).expect(
      // Supply the literal value used by the enclosing expression.
      401
    );
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    // Assert that the value matches the intended expectation.
    expect(emailVerificationService.resendVerificationEmail).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('resends verification for the authenticated user', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await initTestAgent(app);

    // Create the login res constant.
    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      // Call .send to perform this step.
      .send({ email: 'user@example.com', password: 'Secret123' })
      // Call .expect to perform this step.
      .expect(200);
    // Update agent.csrfToken with the right-hand side value.
    agent.csrfToken = loginRes.body.data.csrfToken;

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/auth/resend-verification')).expect(
      // Supply the literal value used by the enclosing expression.
      200
    );

    // Assert that the value matches the intended expectation.
    expect(response.body.data.sent).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(emailVerificationService.resendVerificationEmail).toHaveBeenCalledWith(42);
  });
});
