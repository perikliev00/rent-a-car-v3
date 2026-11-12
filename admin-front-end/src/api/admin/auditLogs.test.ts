// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('../client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from './auditLogs'.
import { getAdminAuditLogs } from './auditLogs';

// Declare a test suite grouping related cases.
describe('admin audit logs API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('getAdminAuditLogs fetches /api/admin/audit-logs', async () => {
    // Create the data constant.
    const data = { logs: [], pagination: { page: 1, limit: 50, total: 0 } };
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue(data);

    // Create the result constant.
    const result = await getAdminAuditLogs();

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/audit-logs');
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(data);
  });

  // Define a single test case and its expectations.
  it('getAdminAuditLogs passes filters as query params', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ logs: [], pagination: { page: 2, limit: 50, total: 0 } });

    // Wait until the asynchronous operation resolves.
    await getAdminAuditLogs({
      // Provide the page field value.
      page: 2,
      // Provide the actor type field value.
      actorType: 'customer',
      // Provide the action prefix field value.
      actionPrefix: 'customer',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: '42',
    });

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith(
      // Continue the surrounding logic with this statement.
      '/api/admin/audit-logs?page=2&actorType=customer&actionPrefix=customer&entityType=reservation&entityId=42'
    );
  });
});
