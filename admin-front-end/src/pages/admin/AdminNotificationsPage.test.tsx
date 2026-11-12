// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/notifications'.
import { getNotifications } from '../../api/admin/notifications';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminNotificationsPage'.
import { AdminNotificationsPage } from './AdminNotificationsPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/notifications', () => ({
  // Provide the get notifications field value.
  getNotifications: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('AdminNotificationsPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getNotifications).mockResolvedValue({
      // Provide the rows field value.
      rows: [
        {
          // Provide the id field value.
          id: '1',
          // Provide the type field value.
          type: 'reservation_confirmation',
          // Provide the channel field value.
          channel: 'email',
          // Provide the recipient email field value.
          recipientEmail: 'a@b.com',
          // Provide the reservation id field value.
          reservationId: '10',
          // Provide the order id field value.
          orderId: '20',
          // Provide the car id field value.
          carId: '3',
          // Provide the status field value.
          status: 'sent',
          // Provide the scheduled at field value.
          scheduledAt: '2026-08-01T10:00:00.000Z',
          // Provide the sent at field value.
          sentAt: '2026-08-01T10:00:01.000Z',
          // Provide the attempts field value.
          attempts: 1,
          // Provide the last error field value.
          lastError: null,
          // Provide the created at field value.
          createdAt: '2026-08-01T10:00:00.000Z',
        },
      ],
      // Provide the total field value.
      total: 1,
      // Provide the limit field value.
      limit: 50,
      // Provide the offset field value.
      offset: 0,
    });
  });

  // Define a single test case and its expectations.
  it('renders notifications page', async () => {
    renderWithRouter(<AdminNotificationsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('reservation_confirmation')).toBeInTheDocument();
  });
});
