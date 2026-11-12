import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('./client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { createContact } from './contacts';

describe('public contacts API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('createContact posts to /api/contacts', async () => {
    const payload = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: 'Hello',
      message: 'I have a question about booking.',
    };
    mockApi.mockResolvedValue({ contact: { id: '1', ...payload, status: 'new' } });

    await createContact(payload);

    expect(mockApi).toHaveBeenCalledWith('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });
});
