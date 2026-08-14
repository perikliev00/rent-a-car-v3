const rbacService = require('../../src/services/rbac/rbacService');
const roleSql = require('../../src/services/sql/roleSqlService');
const permissionSql = require('../../src/services/sql/permissionSqlService');
const userRoleSql = require('../../src/services/sql/userRoleSqlService');
const userSql = require('../../src/services/sql/userSqlService');

jest.mock('../../src/services/sql/roleSqlService');
jest.mock('../../src/services/sql/permissionSqlService');
jest.mock('../../src/services/sql/userRoleSqlService');
jest.mock('../../src/services/sql/userSqlService');
jest.mock('../../src/db/transaction', () => ({
  runWithTransaction: async (work) => work({}),
  clientQuery: jest.fn().mockResolvedValue({ rows: [] }),
}));

describe('rbacService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getUserAccess returns all permissions for owner', async () => {
    userRoleSql.listRolesForUser.mockResolvedValue([
      { roleId: '1', roleSlug: 'owner', roleName: 'Owner' },
    ]);
    permissionSql.listPermissions.mockResolvedValue([
      { key: 'can_view_orders' },
      { key: 'can_manage_users' },
    ]);

    const access = await rbacService.getUserAccess(10);
    expect(access.roles).toEqual(['owner']);
    expect(access.permissions).toEqual(['can_view_orders', 'can_manage_users']);
  });

  test('userHasPermission respects owner bypass', () => {
    expect(
      rbacService.userHasPermission({ roles: ['owner'], permissions: [] }, 'can_manage_users')
    ).toBe(true);
  });

  test('updateRolePermissions rejects owner role edits', async () => {
    roleSql.findRoleById.mockResolvedValue({ id: '1', slug: 'owner', name: 'Owner' });

    await expect(rbacService.updateRolePermissions(1, ['can_view_orders'])).rejects.toMatchObject({
      code: 'OWNER_LOCKED',
      status: 409,
    });
  });

  test('setUserRoles prevents removing last owner', async () => {
    userSql.findUserById.mockResolvedValue({ id: '5', role: 'admin', email: 'a@b.c' });
    roleSql.findRolesByIds.mockResolvedValue([{ id: '2', slug: 'manager' }]);
    roleSql.findRoleBySlug.mockResolvedValue({ id: '1', slug: 'owner' });
    userRoleSql.userHasRoleSlug.mockResolvedValue(true);
    userRoleSql.countUsersWithRoleSlug.mockResolvedValue(1);

    await expect(rbacService.setUserRoles(5, [2])).rejects.toMatchObject({
      code: 'LAST_OWNER',
      status: 409,
    });
  });

  test('assignUserRole upgrades legacy user to staff', async () => {
    userSql.findUserById.mockResolvedValue({ id: '9', role: 'user', email: 's@b.c' });
    roleSql.findRoleById.mockResolvedValue({ id: '3', slug: 'driver', name: 'Driver' });
    userRoleSql.assignRoleToUser.mockResolvedValue([
      { roleId: '3', roleSlug: 'driver', roleName: 'Driver' },
    ]);

    const result = await rbacService.assignUserRole(9, 3, 1);
    expect(result.roles).toEqual([{ id: '3', slug: 'driver', name: 'Driver' }]);
  });
});
