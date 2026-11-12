// Require the 'supertest' module as request.
const request = require('supertest');
// Require the 'bcrypt' module as bcrypt.
const bcrypt = require('bcrypt');
// Destructure object properties into local variables.
const { createApiTestApp, initTestAgent, withCsrf } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');

// Call jest.mock to perform this step.
jest.mock('../../../src/services/reservationService', () => ({}));
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../../helpers/rateLimitPassthrough')
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/rbac/rbacService', () =>
  // Call require to perform this step.
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/userSqlService', () => ({
  // Provide the find user by email field value.
  findUserByEmail: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/account/accountClaimService', () => ({
  // Provide the claim reservations for user field value.
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/dashboardService', () => ({
  // Provide the get dashboard data field value.
  getDashboardData: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/services/sql/userSqlService' module as userSql.
const userSql = require('../../../src/services/sql/userSqlService');
// Require the '../../../src/services/admin/dashboardService' module as dashboardService.
const dashboardService = require('../../../src/services/admin/dashboardService');

// Declare a test suite grouping related cases.
describe('GET /api/admin/dashboard', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call dashboardService.getDashboardData.mockResolvedValue to perform this step.
    dashboardService.getDashboardData.mockResolvedValue({
      // Provide the orders field value.
      orders: [{ id: 1, totalPrice: '120.00' }],
      // Provide the stats field value.
      stats: { totalOrders: 1, totalRevenue: '120.00', pendingOrders: 0 },
    });
  });

  // Define a single test case and its expectations.
  test('returns dashboard data for admin', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/dashboard').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: {
        // Provide the orders field value.
        orders: [{ id: 1, totalPrice: '120.00' }],
        // Provide the stats field value.
        stats: { totalOrders: 1, totalRevenue: '120.00', pendingOrders: 0 },
      },
    });
  });

  // Define a single test case and its expectations.
  test('returns unauthorized without session', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/admin/dashboard').expect(401);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  // Define a single test case and its expectations.
  test('returns forbidden for non-admin user', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the customer user constant.
    const customerUser = {
      // Provide the id field value.
      id: 2,
      // Provide the email field value.
      email: 'user@example.com',
      // Provide the password field value.
      password: 'hashed-password',
      // Provide the role field value.
      role: 'user',
    };
    // Call userSql.findUserByEmail.mockResolvedValue to perform this step.
    userSql.findUserByEmail.mockResolvedValue(customerUser);
    // Call bcrypt.compare.mockResolvedValue to perform this step.
    bcrypt.compare.mockResolvedValue(true);

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
    const response = await agent.get('/api/admin/dashboard').expect(403);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
