const request = require('supertest');
const { createApiTestApp } = require('../../helpers/apiTestApp');
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

jest.mock('../../../src/middleware/rateLimit', () =>
  require('../../helpers/rateLimitPassthrough')
);
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

const notificationsService = require('../../../src/modules/notifications/notifications.service');
const rbacService = require('../../../src/services/rbac/rbacService');

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
