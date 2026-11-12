import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNotifications } from '../../api/admin/notifications';
import { renderWithRouter } from '../../test/test-utils';
import { AdminNotificationsPage } from './AdminNotificationsPage';

vi.mock('../../api/admin/notifications', () => ({
  getNotifications: vi.fn(),
}));

describe('AdminNotificationsPage', () => {
  beforeEach(() => {
    vi.mocked(getNotifications).mockResolvedValue({
      rows: [
        {
          id: '1',
          type: 'reservation_confirmation',
          channel: 'email',
          recipientEmail: 'a@b.com',
          reservationId: '10',
          orderId: '20',
          carId: '3',
          status: 'sent',
          scheduledAt: '2026-08-01T10:00:00.000Z',
          sentAt: '2026-08-01T10:00:01.000Z',
          attempts: 1,
          lastError: null,
          createdAt: '2026-08-01T10:00:00.000Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
  });

  it('renders notifications page', async () => {
    renderWithRouter(<AdminNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    });

    expect(screen.getByText('reservation_confirmation')).toBeInTheDocument();
  });
});
