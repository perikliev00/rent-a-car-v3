import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminAuditLogs } from '../../api/admin/auditLogs';
import { renderWithRouter } from '../../test/test-utils';
import { AdminAuditLogsPage } from './AdminAuditLogsPage';

vi.mock('../../api/admin/auditLogs', () => ({
  getAdminAuditLogs: vi.fn(),
}));

describe('AdminAuditLogsPage', () => {
  beforeEach(() => {
    vi.mocked(getAdminAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 1,
          createdAt: '2026-07-29T12:00:00.000Z',
          action: 'admin.created_car',
          category: 'admin',
          actorType: 'admin',
          adminUser: { id: 1, email: 'admin@example.com' },
          entityType: 'car',
          entityId: '7',
          metadata: { name: 'BMW X5' },
          ipAddress: '127.0.0.1',
        },
      ],
      pagination: { page: 1, limit: 50, total: 1 },
    });
  });

  it('renders audit logs page and rows', async () => {
    renderWithRouter(<AdminAuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Audit logs' })).toBeInTheDocument();
    });

    expect(screen.getByText('Created car')).toBeInTheDocument();
    expect(screen.getByText('car #7')).toBeInTheDocument();
    expect(getAdminAuditLogs).toHaveBeenCalled();
  });
});
