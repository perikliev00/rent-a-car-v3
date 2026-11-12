// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/userSqlService', () => ({
  // Provide the find user by id field value.
  findUserById: jest.fn(),
  // Provide the create user field value.
  createUser: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/userRoleSqlService', () => ({
  // Provide the list staff users with roles field value.
  listStaffUsersWithRoles: jest.fn(),
  // Provide the replace user roles field value.
  replaceUserRoles: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/roleSqlService', () => ({
  // Provide the find roles by ids field value.
  findRolesByIds: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/rbac/rbacService', () => ({
  // Provide the get user access field value.
  getUserAccess: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/db/transaction', () => ({
  // Provide the run with transaction field value.
  runWithTransaction: jest.fn(async (fn) => fn({})),
  // Provide the client query field value.
  clientQuery: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the hash field value.
  hash: jest.fn().mockResolvedValue('hashed'),
}));

// Require the '../../../src/services/admin/userAdminService' module as userAdminService.
const userAdminService = require('../../../src/services/admin/userAdminService');
// Require the '../../../src/services/sql/userSqlService' module as userSql.
const userSql = require('../../../src/services/sql/userSqlService');
// Require the '../../../src/services/sql/roleSqlService' module as roleSql.
const roleSql = require('../../../src/services/sql/roleSqlService');
// Require the '../../../src/services/sql/userRoleSqlService' module as userRoleSql.
const userRoleSql = require('../../../src/services/sql/userRoleSqlService');
// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');

// Declare a test suite grouping related cases.
describe('userAdminService', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('getUser throws NOT_FOUND when missing', async () => {
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue(null);
    // Wait until the asynchronous operation resolves.
    await expect(userAdminService.getUser(99)).rejects.toMatchObject({
      // Provide the code field value.
      code: 'NOT_FOUND',
      // Provide the status field value.
      status: 404,
    });
  });

  // Define a single test case and its expectations.
  test('getUser returns access details', async () => {
    // Call userSql.findUserById.mockResolvedValue to perform this step.
    userSql.findUserById.mockResolvedValue({
      // Provide the id field value.
      id: 9,
      // Provide the email field value.
      email: 'staff@example.com',
      // Provide the role field value.
      role: 'staff',
      // Provide the created at field value.
      createdAt: 'a',
      // Provide the updated at field value.
      updatedAt: 'b',
    });
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the role details field value.
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
      // Provide the permissions field value.
      permissions: ['can_view_calendar'],
    });

    // Create the user constant.
    const user = await userAdminService.getUser(9);
    // Assert that the value matches the intended expectation.
    expect(user.email).toBe('staff@example.com');
    // Assert that the value matches the intended expectation.
    expect(user.roles[0].slug).toBe('driver');
    // Assert that the value matches the intended expectation.
    expect(user.permissions).toContain('can_view_calendar');
  });

  // Define a single test case and its expectations.
  test('createStaffUser requires email and password', async () => {
    // Wait until the asynchronous operation resolves.
    await expect(
      // Call userAdminService.createStaffUser to perform this step.
      userAdminService.createStaffUser({ email: '', password: '', roleIds: [1] })
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 422 });
  });

  // Define a single test case and its expectations.
  test('createStaffUser requires at least one role', async () => {
    // Wait until the asynchronous operation resolves.
    await expect(
      // Call userAdminService.createStaffUser to perform this step.
      userAdminService.createStaffUser({
        // Provide the email field value.
        email: 'a@b.com',
        // Provide the password field value.
        password: 'Secret123!',
        // Provide the role ids field value.
        roleIds: [],
      })
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 422 });
  });

  // Define a single test case and its expectations.
  test('createStaffUser creates user with roles', async () => {
    // Call roleSql.findRolesByIds.mockResolvedValue to perform this step.
    roleSql.findRolesByIds.mockResolvedValue([{ id: 3, slug: 'driver', name: 'Driver' }]);
    // Call userSql.createUser.mockResolvedValue to perform this step.
    userSql.createUser.mockResolvedValue({
      // Provide the id field value.
      id: 12,
      // Provide the email field value.
      email: 'new@example.com',
      // Provide the role field value.
      role: 'staff',
      // Provide the created at field value.
      createdAt: 'a',
      // Provide the updated at field value.
      updatedAt: 'b',
    });
    // Call userRoleSql.replaceUserRoles.mockResolvedValue to perform this step.
    userRoleSql.replaceUserRoles.mockResolvedValue([
      // Contribute this line to the enclosing declaration or statement.
      { roleId: '3', roleSlug: 'driver', roleName: 'Driver' },
    ]);

    // Create the user constant.
    const user = await userAdminService.createStaffUser({
      // Provide the email field value.
      email: 'new@example.com',
      // Provide the password field value.
      password: 'Secret123!',
      // Provide the role ids field value.
      roleIds: [3],
    });

    // Assert that the value matches the intended expectation.
    expect(user.id).toBe(12);
    // Assert that the value matches the intended expectation.
    expect(user.roles[0].slug).toBe('driver');
  });

  // Define a single test case and its expectations.
  test('createStaffUser maps EMAIL_IN_USE', async () => {
    // Call roleSql.findRolesByIds.mockResolvedValue to perform this step.
    roleSql.findRolesByIds.mockResolvedValue([{ id: 3 }]);
    // Create the err constant.
    const err = new Error('dup');
    // Update err.code with the right-hand side value.
    err.code = 'EMAIL_IN_USE';
    // Call userSql.createUser.mockRejectedValue to perform this step.
    userSql.createUser.mockRejectedValue(err);

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call userAdminService.createStaffUser to perform this step.
      userAdminService.createStaffUser({
        // Provide the email field value.
        email: 'dup@example.com',
        // Provide the password field value.
        password: 'Secret123!',
        // Provide the role ids field value.
        roleIds: [3],
      })
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({ code: 'EMAIL_IN_USE', status: 409 });
  });
});
