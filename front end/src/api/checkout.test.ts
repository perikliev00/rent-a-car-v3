// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('./client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from './checkout'.
import { checkoutCancel, checkoutSuccess, startCheckout } from './checkout';

// Declare a test suite grouping related cases.
describe('checkout API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('startCheckout posts body to /api/checkout', async () => {
    // Create the body constant.
    const body = { orderId: 99 };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ checkoutUrl: 'https://pay.example/session' });

    // Create the result constant.
    const result = await startCheckout(body);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/checkout', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify(body),
    });
    // Assert that the value matches the intended expectation.
    expect(result.checkoutUrl).toContain('https://');
  });

  // Define a single test case and its expectations.
  it('checkoutSuccess encodes session_id in query string', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ orderId: 1, status: 'paid' });
    // Wait until the asynchronous operation resolves.
    await checkoutSuccess('sess/id+special');

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/checkout/success?session_id=sess%2Fid%2Bspecial');
  });

  // Define a single test case and its expectations.
  it('checkoutCancel posts to /api/checkout/cancel', async () => {
    // Create the payload constant.
    const payload = {
      // Provide the cancelled field value.
      cancelled: true,
      // Provide the message field value.
      message: 'Payment cancelled',
      // Provide the support email field value.
      supportEmail: 'help@example.com',
    };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue(payload);

    // Create the result constant.
    const result = await checkoutCancel();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/checkout/cancel', { method: 'POST' });
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(payload);
  });
});
