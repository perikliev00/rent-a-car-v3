const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApiTestApp, initTestAgent, withCsrf } = require('../../helpers/apiTestApp');

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
jest.mock('../../../src/services/admin/paymentAdminService', () => ({
  getPaymentMonitoringData: jest.fn(),
  runPaymentReconciliation: jest.fn(),
}));
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const userSql = require('../../../src/services/sql/userSqlService');
const paymentAdminService = require('../../../src/services/admin/paymentAdminService');

const adminUser = {
  id: 1,
  email: 'admin@example.com',
  password: 'hashed-password',
  role: 'admin',
};

const mockMonitoringData = {
  events: [{ id: 1, event_type: 'checkout.session.completed' }],
  failures: [{ id: 2, reason: 'overlap_after_payment' }],
  unresolvedFailureCount: 1,
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

describe('GET /api/admin/payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentAdminService.getPaymentMonitoringData.mockResolvedValue(mockMonitoringData);
  });

  test('returns payment monitoring data for admin', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/payments').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: mockMonitoringData,
    });
  });
});

describe('POST /api/admin/payments/reconcile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentAdminService.runPaymentReconciliation.mockResolvedValue({
      stdout: 'done',
      stderr: '',
    });
  });

  test('runs reconciliation', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/payments/reconcile'))
      .send({ dryRun: true })
      .expect(200);

    expect(response.body.data).toEqual({ ok: true, dryRun: true });
    expect(paymentAdminService.runPaymentReconciliation).toHaveBeenCalledWith({ dryRun: true });
  });
});

describe('admin payments authorization', () => {
  test('returns unauthorized without session', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/admin/payments').expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
