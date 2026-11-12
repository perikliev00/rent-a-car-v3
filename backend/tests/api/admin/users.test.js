// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
// Destructure object properties into local variables.
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

// Call jest.mock to perform this step.
jest.mock('../../../src/services/reservationService', () => ({}));
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../../helpers/rateLimitPassthrough')
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/rbac/rbacService', () => {
  // Require the '../../helpers/rbacTestAccess' module as base.
  const base = require('../../helpers/rbacTestAccess').createOwnerRbacMock();
  // Return the resulting value to the caller.
  return {
    // Spread base into the surrounding structure.
    ...base,
    // Provide the set user roles field value.
    setUserRoles: jest.fn(),
    // Provide the assign user role field value.
    assignUserRole: jest.fn(),
    // Provide the revoke user role field value.
    revokeUserRole: jest.fn(),
  };
});
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
jest.mock('../../../src/services/admin/userAdminService', () => ({
  // Provide the list users field value.
  listUsers: jest.fn(),
  // Provide the get user field value.
  getUser: jest.fn(),
  // Provide the create staff user field value.
  createStaffUser: jest.fn(),
  // Provide the update staff user field value.
  updateStaffUser: jest.fn(),
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

// Require the '../../../src/services/admin/userAdminService' module as userAdminService.
const userAdminService = require('../../../src/services/admin/userAdminService');
// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../../src/services/admin/adminAuditService');

// Declare a test suite grouping related cases.
describe('Admin users APIs', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: ALL_PERMISSIONS,
      // Provide the role details field value.
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/users lists staff users', async () => {
    // Call userAdminService.listUsers.mockResolvedValue to perform this step.
    userAdminService.listUsers.mockResolvedValue([
      {
        // Provide the id field value.
        id: '1',
        // Provide the email field value.
        email: 'admin@example.com',
        // Provide the role field value.
        role: 'admin',
        // Provide the roles field value.
        roles: [{ id: '1', slug: 'owner', name: 'Owner' }],
      },
    ]);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await agent.get('/api/admin/users').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.users).toHaveLength(1);
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/users/:id returns user detail', async () => {
    // Call userAdminService.getUser.mockResolvedValue to perform this step.
    userAdminService.getUser.mockResolvedValue({
      // Provide the id field value.
      id: '9',
      // Provide the email field value.
      email: 'staff@example.com',
      // Provide the role field value.
      role: 'staff',
      // Provide the roles field value.
      roles: [{ id: '3', slug: 'driver', name: 'Driver' }],
      // Provide the permissions field value.
      permissions: ['can_view_calendar'],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await agent.get('/api/admin/users/9').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.user.email).toBe('staff@example.com');
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/users/:id returns 404 when missing', async () => {
    // Create the err constant.
    const err = new Error('User not found.');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Call userAdminService.getUser.mockRejectedValue to perform this step.
    userAdminService.getUser.mockRejectedValue(err);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await agent.get('/api/admin/users/999').expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  // Define a single test case and its expectations.
  test('POST /api/admin/users creates staff user', async () => {
    // Call userAdminService.createStaffUser.mockResolvedValue to perform this step.
    userAdminService.createStaffUser.mockResolvedValue({
      // Provide the id field value.
      id: '12',
      // Provide the email field value.
      email: 'new@example.com',
      // Provide the role field value.
      role: 'staff',
      // Provide the roles field value.
      roles: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/users'))
      // Call .send to perform this step.
      .send({
        // Provide the email field value.
        email: 'new@example.com',
        // Provide the password field value.
        password: 'Secret123!',
        // Provide the role ids field value.
        roleIds: ['3'],
      })
      // Call .expect to perform this step.
      .expect(201);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.user.id).toBe('12');
    // Assert that the value matches the intended expectation.
    expect(userAdminService.createStaffUser).toHaveBeenCalledWith({
      // Provide the email field value.
      email: 'new@example.com',
      // Provide the password field value.
      password: 'Secret123!',
      // Provide the role ids field value.
      roleIds: ['3'],
    });
    // Assert that the value matches the intended expectation.
    expect(logAdminAction).toHaveBeenCalledWith(
      // Call expect.anything to perform this step.
      expect.anything(),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ action: 'user.create' })
    );
  });

  // Define a single test case and its expectations.
  test('POST /api/admin/users surfaces EMAIL_IN_USE', async () => {
    // Create the err constant.
    const err = new Error('Email is already in use.');
    // Update err.code with the right-hand side value.
    err.code = 'EMAIL_IN_USE';
    // Update err.status with the right-hand side value.
    err.status = 409;
    // Call userAdminService.createStaffUser.mockRejectedValue to perform this step.
    userAdminService.createStaffUser.mockRejectedValue(err);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/users'))
      // Call .send to perform this step.
      .send({ email: 'dup@example.com', password: 'Secret123!', roleIds: ['3'] })
      // Call .expect to perform this step.
      .expect(409);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('EMAIL_IN_USE');
  });

  // Define a single test case and its expectations.
  test('PATCH /api/admin/users/:id updates email', async () => {
    // Call userAdminService.updateStaffUser.mockResolvedValue to perform this step.
    userAdminService.updateStaffUser.mockResolvedValue({
      // Provide the id field value.
      id: '9',
      // Provide the email field value.
      email: 'renamed@example.com',
      // Provide the role field value.
      role: 'staff',
      // Provide the roles field value.
      roles: [],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.patch('/api/admin/users/9'))
      // Call .send to perform this step.
      .send({ email: 'renamed@example.com' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.user.email).toBe('renamed@example.com');
    // Assert that the value matches the intended expectation.
    expect(userAdminService.updateStaffUser).toHaveBeenCalledWith('9', {
      // Provide the email field value.
      email: 'renamed@example.com',
    });
  });

  // Define a single test case and its expectations.
  test('PUT /api/admin/users/:id/roles replaces roles', async () => {
    // Call rbacService.setUserRoles.mockResolvedValue to perform this step.
    rbacService.setUserRoles.mockResolvedValue({
      // Provide the user id field value.
      userId: '9',
      // Provide the roles field value.
      roles: [{ id: '2', slug: 'manager', name: 'Manager' }],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.put('/api/admin/users/9/roles'))
      // Call .send to perform this step.
      .send({ roleIds: ['2'] })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.roles[0].slug).toBe('manager');
    // Assert that the value matches the intended expectation.
    expect(rbacService.setUserRoles).toHaveBeenCalledWith('9', ['2'], 1);
  });

  // Define a single test case and its expectations.
  test('POST /api/admin/users/:id/roles/:roleId assigns role', async () => {
    // Call rbacService.assignUserRole.mockResolvedValue to perform this step.
    rbacService.assignUserRole.mockResolvedValue({
      // Provide the user id field value.
      userId: '9',
      // Provide the roles field value.
      roles: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/users/9/roles/3')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.roles[0].slug).toBe('driver');
    // Assert that the value matches the intended expectation.
    expect(rbacService.assignUserRole).toHaveBeenCalledWith('9', '3', 1);
  });

  // Define a single test case and its expectations.
  test('DELETE /api/admin/users/:id/roles/:roleId revokes role', async () => {
    // Call rbacService.revokeUserRole.mockResolvedValue to perform this step.
    rbacService.revokeUserRole.mockResolvedValue({
      // Provide the user id field value.
      userId: '9',
      // Provide the roles field value.
      roles: [],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(agent, agent.delete('/api/admin/users/9/roles/3')).expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.roles).toEqual([]);
    // Assert that the value matches the intended expectation.
    expect(rbacService.revokeUserRole).toHaveBeenCalledWith('9', '3');
  });

  // Define a single test case and its expectations.
  test('returns 403 without can_manage_users', async () => {
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['driver'],
      // Provide the permissions field value.
      permissions: ['can_view_orders'],
      // Provide the role details field value.
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await agent.get('/api/admin/users').expect(403);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  // Define a single test case and its expectations.
  test('returns 401 without session', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the response constant.
    const response = await request(app).get('/api/admin/users').expect(401);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
