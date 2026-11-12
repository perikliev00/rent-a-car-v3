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
    // Provide the get rbac catalog field value.
    getRbacCatalog: jest.fn(),
    // Provide the update role permissions field value.
    updateRolePermissions: jest.fn(),
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
jest.mock('../../../src/services/admin/userAdminService');
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

// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');

// Declare a test suite grouping related cases.
describe('Admin RBAC APIs', () => {
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
  test('GET /api/admin/rbac returns catalog', async () => {
    // Call rbacService.getRbacCatalog.mockResolvedValue to perform this step.
    rbacService.getRbacCatalog.mockResolvedValue({
      // Provide the roles field value.
      roles: [{ id: '1', slug: 'owner', name: 'Owner' }],
      // Provide the permissions field value.
      permissions: [{ id: '1', key: 'can_view_orders', name: 'View orders' }],
      // Provide the matrix field value.
      matrix: [],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await agent.get('/api/admin/rbac').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.roles).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(rbacService.getRbacCatalog).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('PUT /api/admin/rbac/roles/:roleId/permissions updates matrix', async () => {
    // Call rbacService.updateRolePermissions.mockResolvedValue to perform this step.
    rbacService.updateRolePermissions.mockResolvedValue({
      // Provide the role id field value.
      roleId: '2',
      // Provide the role slug field value.
      roleSlug: 'manager',
      // Provide the permissions field value.
      permissions: ['can_view_orders'],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the response constant.
    const response = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.put to perform this step.
      agent.put('/api/admin/rbac/roles/2/permissions')
    )
      // Call .send to perform this step.
      .send({ permissionKeys: ['can_view_orders'] })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.roleSlug).toBe('manager');
    // Assert that the value matches the intended expectation.
    expect(rbacService.updateRolePermissions).toHaveBeenCalledWith('2', ['can_view_orders']);
  });

  // Define a single test case and its expectations.
  test('PUT /api/admin/users/:id/roles assigns roles', async () => {
    // Call rbacService.setUserRoles.mockResolvedValue to perform this step.
    rbacService.setUserRoles.mockResolvedValue({
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
    const response = await withCsrf(agent, agent.put('/api/admin/users/9/roles'))
      // Call .send to perform this step.
      .send({ roleIds: ['3'] })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.roles[0].slug).toBe('driver');
    // Assert that the value matches the intended expectation.
    expect(rbacService.setUserRoles).toHaveBeenCalled();
  });
});
