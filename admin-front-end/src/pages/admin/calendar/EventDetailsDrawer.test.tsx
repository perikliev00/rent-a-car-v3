import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../../../test/test-utils';
import { EventDetailsDrawer } from './EventDetailsDrawer';
import {
  cancelCalendarReservation,
  deleteCalendarBlock,
  deleteCalendarTask,
  getCalendarEventDetails,
} from '../../../api/admin/calendar';
import { useAuth } from '../../../auth/useAuth';

vi.mock('../../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../../api/admin/calendar', () => ({
  getCalendarEventDetails: vi.fn(),
  cancelCalendarReservation: vi.fn(),
  deleteCalendarBlock: vi.fn(),
  deleteCalendarTask: vi.fn(),
  updateCalendarTaskStatus: vi.fn(),
}));
vi.mock('../../../api/admin/reservations', () => ({
  changeReservationStatus: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('EventDetailsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    mockedUseAuth.mockReturnValue({
      user: {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        roles: ['owner'],
        permissions: [
          'can_view_reservations_ops',
          'can_change_reservation_status',
          'can_cancel_orders',
          'can_create_calendar_blocks',
          'can_create_calendar_tasks',
          'can_move_calendar_reservations',
        ],
      },
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
  });

  it('shows Cancel reservation and calls API on confirm', async () => {
    vi.mocked(getCalendarEventDetails).mockResolvedValue({
      type: 'reservation',
      reservation: {
        id: '42',
        status: 'confirmed',
        fullName: 'Ada',
        email: 'a@b.c',
        pickupDate: '2026-08-10T10:00:00.000Z',
        returnDate: '2026-08-12T10:00:00.000Z',
        carId: '3',
        carName: 'BMW',
      },
      actions: { canCancel: true },
    });
    vi.mocked(cancelCalendarReservation).mockResolvedValue({
      reservation: { id: '42', status: 'cancelled' },
      changed: true,
      oldStatus: 'confirmed',
      newStatus: 'cancelled',
    });

    renderWithRouter(
      <EventDetailsDrawer eventId="reservation:42" open onClose={vi.fn()} />,
    );

    expect(await screen.findByTestId('cancel-reservation')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cancel-reservation'));
    await waitFor(() => {
      expect(cancelCalendarReservation).toHaveBeenCalledWith('42');
    });
  });

  it('keeps task delete button', async () => {
    vi.mocked(getCalendarEventDetails).mockResolvedValue({
      type: 'task',
      task: {
        id: '9',
        title: 'Pickup',
        taskType: 'pickup',
        status: 'pending',
      },
    });

    renderWithRouter(<EventDetailsDrawer eventId="task:9" open onClose={vi.fn()} />);

    expect(await screen.findByText('Pickup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(deleteCalendarTask).not.toHaveBeenCalled();
  });

  it('hides delete for booking-synced blocks and shows hint', async () => {
    vi.mocked(getCalendarEventDetails).mockResolvedValue({
      type: 'blocked',
      block: {
        id: 'blocked:1',
        title: 'Booking',
        start: '2026-08-10T10:00:00.000Z',
        end: '2026-08-12T10:00:00.000Z',
        meta: { blockType: 'booking' },
      },
    });

    renderWithRouter(<EventDetailsDrawer eventId="blocked:1" open onClose={vi.fn()} />);

    expect(await screen.findByText(/synced to a reservation/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(deleteCalendarBlock).not.toHaveBeenCalled();
  });
});
