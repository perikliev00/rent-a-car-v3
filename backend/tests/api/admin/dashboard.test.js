const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApiTestApp, initTestAgent, withCsrf } = require('../../helpers/apiTestApp');
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');

jest.mock('../../../src/services/reservationService', () => ({}));
jest.mock('../../../src/middleware/rateLimit', () => ({
  authLimiter: (_req, _res, next) => next(),
  loginLimiter: (_req, _res, next) => next(),
  signupLimiter: (_req, _res, next) => next(),
  adminLimiter: (_req, _res, next) => next(),
  adminUploadLimiter: (_req, _res, next) => next(),
  accountUploadLimiter: (_req, _res, next) => next(),
}));
jest.mock('../../../src/services/rbac/rbacService', () =>
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
}));
jest.mock('../../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
jest.mock('../../../src/services/admin/dashboardService', () => ({
  getDashboardData: jest.fn(),
}));
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const userSql = require('../../../src/services/sql/userSqlService');
const dashboardService = require('../../../src/services/admin/dashboardService');

describe('GET /api/admin/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dashboardService.getDashboardData.mockResolvedValue({
      orders: [{ id: 1, totalPrice: '120.00' }],
      stats: { totalOrders: 1, totalRevenue: '120.00', pendingOrders: 0 },
    });
  });

  test('returns dashboard data for admin', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/dashboard').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        orders: [{ id: 1, totalPrice: '120.00' }],
        stats: { totalOrders: 1, totalRevenue: '120.00', pendingOrders: 0 },
      },
    });
  });

  test('returns unauthorized without session', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/admin/dashboard').expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  test('returns forbidden for non-admin user', async () => {
    const app = createApiTestApp();
    const customerUser = {
      id: 2,
      email: 'user@example.com',
      password: 'hashed-password',
      role: 'user',
    };
    userSql.findUserByEmail.mockResolvedValue(customerUser);
    bcrypt.compare.mockResolvedValue(true);

    const agent = await initTestAgent(app);

    const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
      .send({ email: 'user@example.com', password: 'Secret123' })
      .expect(200);
    agent.csrfToken = loginRes.body.data.csrfToken;

    const response = await agent.get('/api/admin/dashboard').expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
