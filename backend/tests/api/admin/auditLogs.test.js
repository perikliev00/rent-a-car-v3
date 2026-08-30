const request = require('supertest');
const { createApiTestApp } = require('../../helpers/apiTestApp');
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');

jest.mock('../../../src/services/reservationService', () => ({}));
jest.mock('../../../src/middleware/rateLimit', () => ({
  authLimiter: (_req, _res, next) => next(),
  loginLimiter: (_req, _res, next) => next(),
  signupLimiter: (_req, _res, next) => next(),
  emailVerificationLimiter: (_req, _res, next) => next(),
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
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
  logSystemAction: jest.fn().mockResolvedValue(undefined),
  listAuditLogs: jest.fn(),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const adminAuditService = require('../../../src/services/admin/adminAuditService');

describe('GET /api/admin/audit-logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminAuditService.listAuditLogs.mockResolvedValue({
      logs: [
        {
          id: 1,
          createdAt: '2026-07-29T12:00:00.000Z',
          action: 'admin.created_car',
          category: 'admin',
          actorType: 'admin',
          adminUser: { id: 1, email: 'admin@example.com' },
          entityType: 'car',
          entityId: '7',
          metadata: { name: 'BMW' },
          ipAddress: '127.0.0.1',
        },
      ],
      pagination: { page: 1, limit: 50, total: 1 },
    });
  });

  test('returns audit logs for admin', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/audit-logs').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.logs).toHaveLength(1);
    expect(response.body.data.pagination.total).toBe(1);
    expect(adminAuditService.listAuditLogs).toHaveBeenCalled();
  });

  test('passes filters to service', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    await agent
      .get('/api/admin/audit-logs')
      .query({
        page: 2,
        limit: 25,
        actorType: 'customer',
        actionPrefix: 'customer',
        entityType: 'reservation',
        entityId: '42',
      })
      .expect(200);

    expect(adminAuditService.listAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 25,
        actorType: 'customer',
        actionPrefix: 'customer',
        entityType: 'reservation',
        entityId: '42',
      })
    );
  });

  test('returns unauthorized without session', async () => {
    const app = createApiTestApp();

    const response = await request(app).get('/api/admin/audit-logs').expect(401);

    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
