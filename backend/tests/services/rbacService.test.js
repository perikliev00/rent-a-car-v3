// Require the '../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../src/services/rbac/rbacService');
// Require the '../../src/services/sql/roleSqlService' module as roleSql.
const roleSql = require('../../src/services/sql/roleSqlService');
// Require the '../../src/services/sql/permissionSqlService' module as permissionSql.
const permissionSql = require('../../src/services/sql/permissionSqlService');
// Require the '../../src/services/sql/userRoleSqlService' module as userRoleSql.
const userRoleSql = require('../../src/services/sql/userRoleSqlService');
// Require the '../../src/services/sql/userSqlService' module as userSql.
const userSql = require('../../src/services/sql/userSqlService');
// Destructure object properties into local variables.
const { clientQuery } = require('../../src/db/transaction');

// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/roleSqlService');
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/permissionSqlService');
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/userRoleSqlService');
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/userSqlService');
// Call jest.mock to perform this step.
jest.mock('../../src/services/sql/sessionSqlService', () => ({
  // Provide the destroy sessions for user field value.
  destroySessionsForUser: jest.fn().mockResolvedValue(0),
  // Provide the destroy sessions for role field value.
  destroySessionsForRole: jest.fn().mockResolvedValue(0),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/db/transaction', () => ({
  // Provide the run with transaction field value.
  runWithTransaction: async (work) => work({}),
  // Provide the client query field value.
  clientQuery: jest.fn().mockResolvedValue({ rows: [] }),
}));

// Declare a test suite grouping related cases.
describe('rbacService', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('getUserAccess returns all permissions for owner', async () => {
    // Call userRoleSql.listRolesForUser.mockResolvedValue to perform this step.
    userRoleSql.listRolesForUser.mockResolvedValue([
      // Contribute this line to the enclosing declaration or statement.
      { roleId: '1', roleSlug: 'owner', roleName: 'Owner' },
    ]);
    // Call permissionSql.listPermissions.mockResolvedValue to perform this step.
    permissionSql.listPermissions.mockResolvedValue([
      // Contribute this line to the enclosing declaration or statement.
      { key: 'can_view_orders' },
      // Contribute this line to the enclosing declaration or statement.
      { key: 'can_manage_users' },
    ]);

    // Create the access constant.
    const access = await rbacService.getUserAccess(10);
    // Assert that the value matches the intended expectation.
    expect(access.roles).toEqual(['owner']);
    // Assert that the value matches the intended expectation.
    expect(access.permissions).toEqual(['can_view_orders', 'can_manage_users']);
  });

  // Define a single test case and its expectations.
  test('userHasPermission respects owner bypass', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call rbacService.userHasPermission to perform this step.
      rbacService.userHasPermission({ roles: ['owner'], permissions: [] }, 'can_manage_users')
    // Continue the surrounding logic with this statement.
    ).toBe(true);
  });

  // Define a single test case and its expectations.
  test('isStaffAccess ignores stale users.role — RBAC only', () => {
    // Assert that the value matches the intended expectation.
    expect(rbacService.isStaffAccess({ roles: [], permissions: [] })).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(rbacService.isStaffAccess({ roles: ['driver'], permissions: [] })).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(rbacService.isStaffAccess({ roles: [], permissions: ['can_view_orders'] })).toBe(true);
  });

  // Define a single test case and its expectations.
  test('computeLegacyRoleFromAssigned demotes when empty', () => {
    // Assert that the value matches the intended expectation.
    expect(rbacService.computeLegacyRoleFromAssigned([])).toBe('user');
    // Assert that the value matches the intended expectation.
    expect(rbacService.computeLegacyRoleFromAssigned([{ roleSlug: 'driver' }])).toBe('staff');
    // Assert that the value matches the intended expectation.
    expect(rbacService.computeLegacyRoleFromAssigned([{ roleSlug: 'owner' }])).toBe('admin');
  });

  // Define a single test case and its expectations.
  test('updateRolePermissions rejects owner role edits', async () => {
    // Call roleSql.findRoleById.mockResolvedValue to perform this step.
    roleSql.findRoleById.mockResolvedValue({ id: '1', slug: 'owner', name: 'Owner' });

    // Wait until the asynchronous operation resolves.
    await expect(rbacService.updateRolePermissions(1, ['can_view_orders'])).rejects.toMatchObject({
      // Provide the code field value.
      code: 'OWNER_LOCKED',
      // Provide the status field value.
      status: 409,
    });
  });

  // Define a single test case and its expectations.
  test('setUserRoles prevents removing last owner', async () => {
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue({ id: '5', role: 'admin', email: 'a@b.c' });
    // Call roleSql.findRolesByIds.mockResolvedValue to perform this step.
    roleSql.findRolesByIds.mockResolvedValue([{ id: '2', slug: 'manager' }]);
    // Call roleSql.findRoleBySlug.mockResolvedValue to perform this step.
    roleSql.findRoleBySlug.mockResolvedValue({ id: '1', slug: 'owner' });
    // Call userRoleSql.userHasRoleSlug.mockResolvedValue to perform this step.
    userRoleSql.userHasRoleSlug.mockResolvedValue(true);
    // Call userRoleSql.countUsersWithRoleSlug.mockResolvedValue to perform this step.
    userRoleSql.countUsersWithRoleSlug.mockResolvedValue(1);

    // Wait until the asynchronous operation resolves.
    await expect(rbacService.setUserRoles(5, [2])).rejects.toMatchObject({
      // Provide the code field value.
      code: 'LAST_OWNER',
      // Provide the status field value.
      status: 409,
    });
  });

  // Define a single test case and its expectations.
  test('assignUserRole syncs legacy role to staff', async () => {
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue({ id: '9', role: 'user', email: 's@b.c' });
    // Call roleSql.findRoleById.mockResolvedValue to perform this step.
    roleSql.findRoleById.mockResolvedValue({ id: '3', slug: 'driver', name: 'Driver' });
    // Call userRoleSql.assignRoleToUser.mockResolvedValue to perform this step.
    userRoleSql.assignRoleToUser.mockResolvedValue([
      // Contribute this line to the enclosing declaration or statement.
      { roleId: '3', roleSlug: 'driver', roleName: 'Driver' },
    ]);

    // Create the result constant.
    const result = await rbacService.assignUserRole(9, 3, 1);
    // Assert that the value matches the intended expectation.
    expect(result.roles).toEqual([{ id: '3', slug: 'driver', name: 'Driver' }]);
    // Assert that the value matches the intended expectation.
    expect(clientQuery).toHaveBeenCalledWith(
      {},
      // Call expect.stringContaining to perform this step.
      expect.stringContaining('UPDATE users SET role'),
      // Contribute this line to the enclosing declaration or statement.
      [9, 'staff']
    );
  });

  // Define a single test case and its expectations.
  test('setUserRoles with empty list demotes legacy role to user', async () => {
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue({ id: '9', role: 'staff', email: 's@b.c' });
    // Call roleSql.findRolesByIds.mockResolvedValue to perform this step.
    roleSql.findRolesByIds.mockResolvedValue([]);
    // Call roleSql.findRoleBySlug.mockResolvedValue to perform this step.
    roleSql.findRoleBySlug.mockResolvedValue({ id: '1', slug: 'owner' });
    // Call userRoleSql.userHasRoleSlug.mockResolvedValue to perform this step.
    userRoleSql.userHasRoleSlug.mockResolvedValue(false);
    // Call userRoleSql.replaceUserRoles.mockResolvedValue to perform this step.
    userRoleSql.replaceUserRoles.mockResolvedValue([]);

    // Create the result constant.
    const result = await rbacService.setUserRoles(9, []);
    // Assert that the value matches the intended expectation.
    expect(result.roles).toEqual([]);
    // Assert that the value matches the intended expectation.
    expect(clientQuery).toHaveBeenCalledWith(
      {},
      // Call expect.stringContaining to perform this step.
      expect.stringContaining('UPDATE users SET role'),
      // Contribute this line to the enclosing declaration or statement.
      [9, 'user']
    );
  });
});
