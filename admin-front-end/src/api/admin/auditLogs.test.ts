import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('../client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { getAdminAuditLogs } from './auditLogs';

describe('admin audit logs API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('getAdminAuditLogs fetches /api/admin/audit-logs', async () => {
    const data = { logs: [], pagination: { page: 1, limit: 50, total: 0 } };
    mockApi.mockResolvedValue(data);

    const result = await getAdminAuditLogs();

    expect(mockApi).toHaveBeenCalledWith('/api/admin/audit-logs');
    expect(result).toEqual(data);
  });

  it('getAdminAuditLogs passes filters as query params', async () => {
    mockApi.mockResolvedValue({ logs: [], pagination: { page: 2, limit: 50, total: 0 } });

    await getAdminAuditLogs({
      page: 2,
      actorType: 'customer',
      actionPrefix: 'customer',
      entityType: 'reservation',
      entityId: '42',
    });

    expect(mockApi).toHaveBeenCalledWith(
      '/api/admin/audit-logs?page=2&actorType=customer&actionPrefix=customer&entityType=reservation&entityId=42'
    );
  });
});
