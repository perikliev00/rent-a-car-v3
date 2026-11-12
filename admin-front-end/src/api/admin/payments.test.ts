// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('../client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from './payments'.
import { getPayments, reconcilePayments, getPaymentRefundQueue } from './payments';

// Declare a test suite grouping related cases.
describe('admin payments API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('getPayments fetches /api/admin/payments', async () => {
    // Create the data constant.
    const data = { events: [], failures: [], unresolvedFailureCount: 0 };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue(data);

    // Create the result constant.
    const result = await getPayments();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/payments');
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(data);
  });

  // Define a single test case and its expectations.
  it('reconcilePayments posts dryRun flag defaulting to false', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ ok: true, dryRun: false });
    // Wait until the asynchronous operation resolves.
    await reconcilePayments();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/payments/reconcile', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify({ dryRun: false }),
    });
  });

  // Define a single test case and its expectations.
  it('reconcilePayments passes dryRun true when requested', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ ok: true, dryRun: true });
    // Wait until the asynchronous operation resolves.
    await reconcilePayments(true);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/payments/reconcile', {
      // Provide the method field value.
      method: 'POST',
      // Provide the body field value.
      body: JSON.stringify({ dryRun: true }),
    });
  });

  // Define a single test case and its expectations.
  it('getPaymentRefundQueue fetches queue with filters', async () => {
    // Create the data constant.
    const data = { refundable: [], recentRefunds: [], limit: 50 };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue(data);

    // Create the result constant.
    const result = await getPaymentRefundQueue({
      // Provide the q field value.
      q: '512',
      // Provide the status field value.
      status: 'confirmed',
      // Provide the refund state field value.
      refundState: 'none',
      // Provide the pickup from field value.
      pickupFrom: '2026-08-01',
      // Provide the pickup to field value.
      pickupTo: '2026-08-31',
    });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith(
      // Continue the surrounding logic with this statement.
      '/api/admin/payments/refund-queue?q=512&status=confirmed&refundState=none&pickupFrom=2026-08-01&pickupTo=2026-08-31'
    );
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(data);
  });
});
