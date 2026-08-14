const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApiTestApp, initTestAgent, withCsrf } = require('../../helpers/apiTestApp');
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

jest.mock('../../../src/middleware/rateLimit', () => ({
  authLimiter: (_req, _res, next) => next(),
  loginLimiter: (_req, _res, next) => next(),
  signupLimiter: (_req, _res, next) => next(),
  adminLimiter: (_req, _res, next) => next(),
  adminUploadLimiter: (_req, _res, next) => next(),
  accountUploadLimiter: (_req, _res, next) => next(),
  checkoutLimiter: (_req, _res, next) => next(),
  bookingLimiter: (_req, _res, next) => next(),
  chatLimiter: (_req, _res, next) => next(),
  contactLimiter: (_req, _res, next) => next(),
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
jest.mock('../../../src/modules/notifications/notifications.service', () => ({
  listForAdmin: jest.fn(),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const userSql = require('../../../src/services/sql/userSqlService');
const notificationsService = require('../../../src/modules/notifications/notifications.service');
const rbacService = require('../../../src/services/rbac/rbacService');

const adminUser = {
  id: 1,
  email: 'admin@example.com',
  password: 'hashed-password',
  role: 'admin',
};

async function loginAsAdmin(app) {
  const agent = await initTestAgent(app);
  userSql.findUserByEmail.mockResolvedValue(adminUser);
  bcrypt.compare.mockResolvedValue(true);
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    .send({ email: 'admin@example.com', password: 'Secret123' })
    .expect(200);
  agent.csrfToken = loginRes.body.data.csrfToken;
  return agent;
}

describe('Admin notifications API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['owner'],
      permissions: [...ALL_PERMISSIONS, 'can_manage_notifications'],
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  test('GET /api/admin/notifications returns rows', async () => {
    notificationsService.listForAdmin.mockResolvedValue({
      rows: [{ id: '1', type: 'pickup_reminder', status: 'pending' }],
      total: 1,
      limit: 50,
      offset: 0,
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const res = await agent.get('/api/admin/notifications').expect(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.rows[0].type).toBe('pickup_reminder');
  });
});
