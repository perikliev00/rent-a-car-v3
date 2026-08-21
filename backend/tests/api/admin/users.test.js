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
  checkoutLimiter: (_req, _res, next) => next(),
  bookingLimiter: (_req, _res, next) => next(),
  chatLimiter: (_req, _res, next) => next(),
  contactLimiter: (_req, _res, next) => next(),
}));
jest.mock('../../../src/services/rbac/rbacService', () => {
  const base = require('../../helpers/rbacTestAccess').createOwnerRbacMock();
  return {
    ...base,
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
jest.mock('../../../src/services/admin/userAdminService', () => ({
  listUsers: jest.fn(),
  getUser: jest.fn(),
  createStaffUser: jest.fn(),
  updateStaffUser: jest.fn(),
}));
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const userAdminService = require('../../../src/services/admin/userAdminService');
const rbacService = require('../../../src/services/rbac/rbacService');
const { logAdminAction } = require('../../../src/services/admin/adminAuditService');

describe('Admin users APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['owner'],
      permissions: ALL_PERMISSIONS,
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  test('GET /api/admin/users lists staff users', async () => {
    userAdminService.listUsers.mockResolvedValue([
      {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        roles: [{ id: '1', slug: 'owner', name: 'Owner' }],
      },
    ]);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await agent.get('/api/admin/users').expect(200);

    expect(response.body.data.users).toHaveLength(1);
  });

  test('GET /api/admin/users/:id returns user detail', async () => {
    userAdminService.getUser.mockResolvedValue({
      id: '9',
      email: 'staff@example.com',
      role: 'staff',
      roles: [{ id: '3', slug: 'driver', name: 'Driver' }],
      permissions: ['can_view_calendar'],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await agent.get('/api/admin/users/9').expect(200);

    expect(response.body.data.user.email).toBe('staff@example.com');
  });

  test('GET /api/admin/users/:id returns 404 when missing', async () => {
    const err = new Error('User not found.');
    err.code = 'NOT_FOUND';
    err.status = 404;
    userAdminService.getUser.mockRejectedValue(err);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await agent.get('/api/admin/users/999').expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('POST /api/admin/users creates staff user', async () => {
    userAdminService.createStaffUser.mockResolvedValue({
      id: '12',
      email: 'new@example.com',
      role: 'staff',
      roles: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.post('/api/admin/users'))
      .send({
        email: 'new@example.com',
        password: 'Secret123!',
        roleIds: ['3'],
      })
      .expect(201);

    expect(response.body.data.user.id).toBe('12');
    expect(userAdminService.createStaffUser).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'Secret123!',
      roleIds: ['3'],
    });
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'user.create' })
    );
  });

  test('POST /api/admin/users surfaces EMAIL_IN_USE', async () => {
    const err = new Error('Email is already in use.');
    err.code = 'EMAIL_IN_USE';
    err.status = 409;
    userAdminService.createStaffUser.mockRejectedValue(err);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.post('/api/admin/users'))
      .send({ email: 'dup@example.com', password: 'Secret123!', roleIds: ['3'] })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_IN_USE');
  });

  test('PATCH /api/admin/users/:id updates email', async () => {
    userAdminService.updateStaffUser.mockResolvedValue({
      id: '9',
      email: 'renamed@example.com',
      role: 'staff',
      roles: [],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.patch('/api/admin/users/9'))
      .send({ email: 'renamed@example.com' })
      .expect(200);

    expect(response.body.data.user.email).toBe('renamed@example.com');
    expect(userAdminService.updateStaffUser).toHaveBeenCalledWith('9', {
      email: 'renamed@example.com',
    });
  });

  test('PUT /api/admin/users/:id/roles replaces roles', async () => {
    rbacService.setUserRoles.mockResolvedValue({
      userId: '9',
      roles: [{ id: '2', slug: 'manager', name: 'Manager' }],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.put('/api/admin/users/9/roles'))
      .send({ roleIds: ['2'] })
      .expect(200);

    expect(response.body.data.roles[0].slug).toBe('manager');
    expect(rbacService.setUserRoles).toHaveBeenCalledWith('9', ['2'], 1);
  });

  test('POST /api/admin/users/:id/roles/:roleId assigns role', async () => {
    rbacService.assignUserRole.mockResolvedValue({
      userId: '9',
      roles: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.post('/api/admin/users/9/roles/3')).expect(200);

    expect(response.body.data.roles[0].slug).toBe('driver');
    expect(rbacService.assignUserRole).toHaveBeenCalledWith('9', '3', 1);
  });

  test('DELETE /api/admin/users/:id/roles/:roleId revokes role', async () => {
    rbacService.revokeUserRole.mockResolvedValue({
      userId: '9',
      roles: [],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await withCsrf(agent, agent.delete('/api/admin/users/9/roles/3')).expect(200);

    expect(response.body.data.roles).toEqual([]);
    expect(rbacService.revokeUserRole).toHaveBeenCalledWith('9', '3');
  });

  test('returns 403 without can_manage_users', async () => {
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['driver'],
      permissions: ['can_view_orders'],
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);
    const response = await agent.get('/api/admin/users').expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  test('returns 401 without session', async () => {
    const app = createApiTestApp();
    const response = await request(app).get('/api/admin/users').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
