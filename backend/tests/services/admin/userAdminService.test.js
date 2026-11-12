jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserById: jest.fn(),
  createUser: jest.fn(),
}));
jest.mock('../../../src/services/sql/userRoleSqlService', () => ({
  listStaffUsersWithRoles: jest.fn(),
  replaceUserRoles: jest.fn(),
}));
jest.mock('../../../src/services/sql/roleSqlService', () => ({
  findRolesByIds: jest.fn(),
}));
jest.mock('../../../src/services/rbac/rbacService', () => ({
  getUserAccess: jest.fn(),
}));
jest.mock('../../../src/db/transaction', () => ({
  runWithTransaction: jest.fn(async (fn) => fn({})),
  clientQuery: jest.fn(),
}));
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

const userAdminService = require('../../../src/services/admin/userAdminService');
const userSql = require('../../../src/services/sql/userSqlService');
const roleSql = require('../../../src/services/sql/roleSqlService');
const userRoleSql = require('../../../src/services/sql/userRoleSqlService');
const rbacService = require('../../../src/services/rbac/rbacService');

describe('userAdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getUser throws NOT_FOUND when missing', async () => {
    userSql.findUserById.mockResolvedValue(null);
    await expect(userAdminService.getUser(99)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('getUser returns access details', async () => {
    userSql.findUserById.mockResolvedValue({
      id: 9,
      email: 'staff@example.com',
      role: 'staff',
      createdAt: 'a',
      updatedAt: 'b',
    });
    rbacService.getUserAccess.mockResolvedValue({
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
      permissions: ['can_view_calendar'],
    });

    const user = await userAdminService.getUser(9);
    expect(user.email).toBe('staff@example.com');
    expect(user.roles[0].slug).toBe('driver');
    expect(user.permissions).toContain('can_view_calendar');
  });

  test('createStaffUser requires email and password', async () => {
    await expect(
      userAdminService.createStaffUser({ email: '', password: '', roleIds: [1] })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 422 });
  });

  test('createStaffUser requires at least one role', async () => {
    await expect(
      userAdminService.createStaffUser({
        email: 'a@b.com',
        password: 'Secret123!',
        roleIds: [],
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 422 });
  });

  test('createStaffUser creates user with roles', async () => {
    roleSql.findRolesByIds.mockResolvedValue([{ id: 3, slug: 'driver', name: 'Driver' }]);
    userSql.createUser.mockResolvedValue({
      id: 12,
      email: 'new@example.com',
      role: 'staff',
      createdAt: 'a',
      updatedAt: 'b',
    });
    userRoleSql.replaceUserRoles.mockResolvedValue([
      { roleId: '3', roleSlug: 'driver', roleName: 'Driver' },
    ]);

    const user = await userAdminService.createStaffUser({
      email: 'new@example.com',
      password: 'Secret123!',
      roleIds: [3],
    });

    expect(user.id).toBe(12);
    expect(user.roles[0].slug).toBe('driver');
  });

  test('createStaffUser maps EMAIL_IN_USE', async () => {
    roleSql.findRolesByIds.mockResolvedValue([{ id: 3 }]);
    const err = new Error('dup');
    err.code = 'EMAIL_IN_USE';
    userSql.createUser.mockRejectedValue(err);

    await expect(
      userAdminService.createStaffUser({
        email: 'dup@example.com',
        password: 'Secret123!',
        roleIds: [3],
      })
    ).rejects.toMatchObject({ code: 'EMAIL_IN_USE', status: 409 });
  });
});
