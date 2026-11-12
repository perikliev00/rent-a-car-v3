// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('../client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from './contacts'.
import { deleteContact, getContacts, updateContactStatus } from './contacts';

// Declare a test suite grouping related cases.
describe('admin contacts API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('getContacts fetches /api/admin/contacts', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ contacts: [] });
    // Wait until the asynchronous operation resolves.
    await getContacts();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/contacts');
  });

  // Define a single test case and its expectations.
  it('updateContactStatus patches status for contact id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ contact: { id: 3, status: 'resolved' } });
    // Wait until the asynchronous operation resolves.
    await updateContactStatus('3', 'resolved');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/contacts/3/status', {
      // Provide the method field value.
      method: 'PATCH',
      // Provide the body field value.
      body: JSON.stringify({ status: 'resolved' }),
    });
  });

  // Define a single test case and its expectations.
  it('deleteContact sends DELETE to contact id', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ deleted: true, id: 3 });
    // Wait until the asynchronous operation resolves.
    await deleteContact('3');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/contacts/3', { method: 'DELETE' });
  });
});
