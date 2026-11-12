// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('./client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from './contacts'.
import { createContact } from './contacts';

// Declare a test suite grouping related cases.
describe('public contacts API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('createContact posts to /api/contacts', async () => {
    // Create the payload constant.
    const payload = {
      // Provide the name field value.
      name: 'Jane Doe',
      // Provide the email field value.
      email: 'jane@example.com',
      // Provide the subject field value.
      subject: 'Hello',
      // Provide the message field value.
      message: 'I have a question about booking.',
    };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ contact: { id: '1', ...payload, status: 'new' } });

    // Wait until the asynchronous operation resolves.
    await createContact(payload);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/contacts', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify(payload),
    });
  });
});
