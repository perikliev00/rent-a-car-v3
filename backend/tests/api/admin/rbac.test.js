const request = require('supertest');
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

jest.mock('../../../src/services/reservationService', () => ({}));
jest.mock('../../../src/middleware/rateLimit', () => ({
  authLimiter: (_req, _res, next) => next(),
  loginLimiter: (_req, _res, next) => next(),
  signupLimiter: (_req, _res, next) => next(),
  adminLimiter: (_req, _res, next) => next(),
  adminUploadLimiter: (_req, _res, next) => next(),
  accountUploadLimiter: (_req, _res, next) => next(),
}));
jest.mock('../../../src/services/rbac/rbacService', () => {
  const base = require('../../helpers/rbacTestAccess').createOwnerRbacMock();
  return {
    ...base,
    getRbacCatalog: jest.fn(),
    updateRolePermissions: jest.fn(),
    setUserRoles: jest.fn(),
    assignUserRole: jest.fn(),
    revokeUserRole: jest.fn(),
  };
});
jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
}));
jest.mock('../../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
jest.mock('../../../src/services/admin/userAdminService');
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const rbacService = require('../../../src/services/rbac/rbacService');

describe('Admin RBAC APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['owner'],
      permissions: ALL_PERMISSIONS,
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  test('GET /api/admin/rbac returns catalog', async () => {
    rbacService.getRbacCatalog.mockResolvedValue({
      roles: [{ id: '1', slug: 'owner', name: 'Owner' }],
      permissions: [{ id: '1', key: 'can_view_orders', name: 'View orders' }],
      matrix: [],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await agent.get('/api/admin/rbac').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.roles).toHaveLength(1);
    expect(rbacService.getRbacCatalog).toHaveBeenCalled();
  });

  test('PUT /api/admin/rbac/roles/:roleId/permissions updates matrix', async () => {
    rbacService.updateRolePermissions.mockResolvedValue({
      roleId: '2',
      roleSlug: 'manager',
      permissions: ['can_view_orders'],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(
      agent,
      agent.put('/api/admin/rbac/roles/2/permissions')
    )
      .send({ permissionKeys: ['can_view_orders'] })
      .expect(200);

    expect(response.body.data.roleSlug).toBe('manager');
    expect(rbacService.updateRolePermissions).toHaveBeenCalledWith('2', ['can_view_orders']);
  });

  test('PUT /api/admin/users/:id/roles assigns roles', async () => {
    rbacService.setUserRoles.mockResolvedValue({
      userId: '9',
      roles: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.put('/api/admin/users/9/roles'))
      .send({ roleIds: ['3'] })
      .expect(200);

    expect(response.body.data.roles[0].slug).toBe('driver');
    expect(rbacService.setUserRoles).toHaveBeenCalled();
  });
});
