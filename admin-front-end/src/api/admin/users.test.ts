// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('../client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  assignUserRole,
  // Contribute this line to the enclosing declaration or statement.
  createAdminUser,
  // Contribute this line to the enclosing declaration or statement.
  getAdminUsers,
  // Contribute this line to the enclosing declaration or statement.
  putUserRoles,
  // Contribute this line to the enclosing declaration or statement.
  revokeUserRole,
  // Contribute this line to the enclosing declaration or statement.
  updateAdminUser,
// Contribute this line to the enclosing declaration or statement.
} from './users';

// Declare a test suite grouping related cases.
describe('admin users API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('getAdminUsers fetches list', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ users: [] });
    // Wait until the asynchronous operation resolves.
    await getAdminUsers();
    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/users');
  });

  // Define a single test case and its expectations.
  it('createAdminUser posts payload', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ user: { id: '1' } });
    // Wait until the asynchronous operation resolves.
    await createAdminUser({
      // Provide the email field value.
      email: 'staff@example.com',
      // Provide the password field value.
      password: 'Secret123!',
      // Provide the role ids field value.
      roleIds: ['3'],
    });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/users', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify({
        // Provide the email field value.
        email: 'staff@example.com',
        // Provide the password field value.
        password: 'Secret123!',
        // Provide the role ids field value.
        roleIds: ['3'],
      }),
    });
  });

  // Define a single test case and its expectations.
  it('updateAdminUser patches email', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ user: { id: '9' } });
    // Wait until the asynchronous operation resolves.
    await updateAdminUser('9', { email: 'new@example.com' });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/users/9', {
      // Provide the method field value.
      method: 'PATCH',
      // Provide the body field value.
      body: JSON.stringify({ email: 'new@example.com' }),
    });
  });

  // Define a single test case and its expectations.
  it('putUserRoles replaces roles', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ userId: '9', roles: [] });
    // Wait until the asynchronous operation resolves.
    await putUserRoles('9', ['2', '3']);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/users/9/roles', {
      // Provide the method field value.
      method: 'PUT',
      // Provide the body field value.
      body: JSON.stringify({ roleIds: ['2', '3'] }),
    });
  });

  // Define a single test case and its expectations.
  it('assignUserRole posts role id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ userId: '9', roles: [] });
    // Wait until the asynchronous operation resolves.
    await assignUserRole('9', '3');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/users/9/roles/3', { method: 'POST' });
  });

  // Define a single test case and its expectations.
  it('revokeUserRole deletes role id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ userId: '9', roles: [] });
    // Wait until the asynchronous operation resolves.
    await revokeUserRole('9', '3');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/users/9/roles/3', { method: 'DELETE' });
  });
});
