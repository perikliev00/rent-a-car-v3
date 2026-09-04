import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('../client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { deleteContact, getContacts, updateContactStatus } from './contacts';

describe('admin contacts API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('getContacts fetches /api/admin/contacts', async () => {
    mockApi.mockResolvedValue({ contacts: [] });
    await getContacts();

    expect(mockApi).toHaveBeenCalledWith('/api/admin/contacts');
  });

  it('updateContactStatus patches status for contact id', async () => {
    mockApi.mockResolvedValue({ contact: { id: 3, status: 'resolved' } });
    await updateContactStatus('3', 'resolved');

    expect(mockApi).toHaveBeenCalledWith('/api/admin/contacts/3/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved' }),
    });
  });

  it('deleteContact sends DELETE to contact id', async () => {
    mockApi.mockResolvedValue({ deleted: true, id: 3 });
    await deleteContact('3');

    expect(mockApi).toHaveBeenCalledWith('/api/admin/contacts/3', { method: 'DELETE' });
  });
});
