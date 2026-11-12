// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/auditLogs'.
import { getAdminAuditLogs } from '../../api/admin/auditLogs';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminAuditLogsPage'.
import { AdminAuditLogsPage } from './AdminAuditLogsPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/auditLogs', () => ({
  // Provide the get admin audit logs field value.
  getAdminAuditLogs: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('AdminAuditLogsPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getAdminAuditLogs).mockResolvedValue({
      // Provide the logs field value.
      logs: [
        {
          // Provide the id field value.
          id: 1,
          // Provide the created at field value.
          createdAt: '2026-07-29T12:00:00.000Z',
          // Provide the action field value.
          action: 'admin.created_car',
          // Provide the category field value.
          category: 'admin',
          // Provide the actor type field value.
          actorType: 'admin',
          // Provide the admin user field value.
          adminUser: { id: 1, email: 'admin@example.com' },
          // Provide the entity type field value.
          entityType: 'car',
          // Provide the entity id field value.
          entityId: '7',
          // Provide the metadata field value.
          metadata: { name: 'BMW X5' },
          // Provide the ip address field value.
          ipAddress: '127.0.0.1',
        },
      ],
      // Provide the pagination field value.
      pagination: { page: 1, limit: 50, total: 1 },
    });
  });

  // Define a single test case and its expectations.
  it('renders audit logs page and rows', async () => {
    renderWithRouter(<AdminAuditLogsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Audit logs' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Created car')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('car #7')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(getAdminAuditLogs).toHaveBeenCalled();
  });
});
