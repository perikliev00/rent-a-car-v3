// Import named exports from '@testing-library/react'.
import { fireEvent, screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../../test/test-utils'.
import { renderWithRouter } from '../../../test/test-utils';
// Import named exports from './EventDetailsDrawer'.
import { EventDetailsDrawer } from './EventDetailsDrawer';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cancelCalendarReservation,
  // Contribute this line to the enclosing declaration or statement.
  deleteCalendarBlock,
  // Contribute this line to the enclosing declaration or statement.
  deleteCalendarTask,
  // Contribute this line to the enclosing declaration or statement.
  getCalendarEventDetails,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/calendar';
// Import named exports from '../../../auth/useAuth'.
import { useAuth } from '../../../auth/useAuth';

// Call vi.mock to perform this step.
vi.mock('../../../auth/useAuth', () => ({
  // Provide the use auth field value.
  useAuth: vi.fn(),
}));
// Call vi.mock to perform this step.
vi.mock('../../../api/admin/calendar', () => ({
  // Provide the get calendar event details field value.
  getCalendarEventDetails: vi.fn(),
  // Provide the cancel calendar reservation field value.
  cancelCalendarReservation: vi.fn(),
  // Provide the delete calendar block field value.
  deleteCalendarBlock: vi.fn(),
  // Provide the delete calendar task field value.
  deleteCalendarTask: vi.fn(),
  // Provide the update calendar task status field value.
  updateCalendarTaskStatus: vi.fn(),
}));
// Call vi.mock to perform this step.
vi.mock('../../../api/admin/reservations', () => ({
  // Provide the change reservation status field value.
  changeReservationStatus: vi.fn(),
}));

// Create the mocked use auth constant.
const mockedUseAuth = vi.mocked(useAuth);

// Declare a test suite grouping related cases.
describe('EventDetailsDrawer', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.clearAllMocks to perform this step.
    vi.clearAllMocks();
    // Update window.confirm with the right-hand side value.
    window.confirm = vi.fn(() => true);
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: {
        // Provide the id field value.
        id: '1',
        // Provide the email field value.
        email: 'admin@example.com',
        // Provide the role field value.
        role: 'admin',
        // Provide the roles field value.
        roles: ['owner'],
        // Provide the permissions field value.
        permissions: [
          // Supply the literal value used by the enclosing expression.
          'can_view_reservations_ops',
          // Supply the literal value used by the enclosing expression.
          'can_change_reservation_status',
          // Supply the literal value used by the enclosing expression.
          'can_cancel_orders',
          // Supply the literal value used by the enclosing expression.
          'can_create_calendar_blocks',
          // Supply the literal value used by the enclosing expression.
          'can_create_calendar_tasks',
          // Supply the literal value used by the enclosing expression.
          'can_move_calendar_reservations',
        ],
      },
      // Provide the is loading field value.
      isLoading: false,
      // Provide the login field value.
      login: vi.fn(),
      // Provide the signup field value.
      signup: vi.fn(),
      // Provide the logout field value.
      logout: vi.fn(),
      // Provide the refresh field value.
      refresh: vi.fn(),
    });
  });

  // Define a single test case and its expectations.
  it('shows Cancel reservation and calls API on confirm', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getCalendarEventDetails).mockResolvedValue({
      // Provide the type field value.
      type: 'reservation',
      // Provide the reservation field value.
      reservation: {
        // Provide the id field value.
        id: '42',
        // Provide the status field value.
        status: 'confirmed',
        // Provide the full name field value.
        fullName: 'Ada',
        // Provide the email field value.
        email: 'a@b.c',
        // Provide the pickup date field value.
        pickupDate: '2026-08-10T10:00:00.000Z',
        // Provide the return date field value.
        returnDate: '2026-08-12T10:00:00.000Z',
        // Provide the car id field value.
        carId: '3',
        // Provide the car name field value.
        carName: 'BMW',
      },
      // Provide the actions field value.
      actions: { canCancel: true },
    });
    // Call vi.mocked to perform this step.
    vi.mocked(cancelCalendarReservation).mockResolvedValue({
      // Provide the reservation field value.
      reservation: { id: '42', status: 'cancelled' },
      // Provide the changed field value.
      changed: true,
      // Provide the old status field value.
      oldStatus: 'confirmed',
      // Provide the new status field value.
      newStatus: 'cancelled',
    });

    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <EventDetailsDrawer eventId="reservation:42" open onClose={vi.fn()} />,
    );

    // Assert that the value matches the intended expectation.
    expect(await screen.findByTestId('cancel-reservation')).toBeInTheDocument();
    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByTestId('cancel-reservation'));
    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(cancelCalendarReservation).toHaveBeenCalledWith('42');
    });
  });

  // Define a single test case and its expectations.
  it('keeps task delete button', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getCalendarEventDetails).mockResolvedValue({
      // Provide the type field value.
      type: 'task',
      // Provide the task field value.
      task: {
        // Provide the id field value.
        id: '9',
        // Provide the title field value.
        title: 'Pickup',
        // Provide the task type field value.
        taskType: 'pickup',
        // Provide the status field value.
        status: 'pending',
      },
    });

    renderWithRouter(<EventDetailsDrawer eventId="task:9" open onClose={vi.fn()} />);

    // Assert that the value matches the intended expectation.
    expect(await screen.findByText('Pickup')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(deleteCalendarTask).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  it('hides delete for booking-synced blocks and shows hint', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getCalendarEventDetails).mockResolvedValue({
      // Provide the type field value.
      type: 'blocked',
      // Provide the block field value.
      block: {
        // Provide the id field value.
        id: 'blocked:1',
        // Provide the title field value.
        title: 'Booking',
        // Provide the start field value.
        start: '2026-08-10T10:00:00.000Z',
        // Provide the end field value.
        end: '2026-08-12T10:00:00.000Z',
        // Provide the meta field value.
        meta: { blockType: 'booking' },
      },
    });

    renderWithRouter(<EventDetailsDrawer eventId="blocked:1" open onClose={vi.fn()} />);

    // Assert that the value matches the intended expectation.
    expect(await screen.findByText(/synced to a reservation/i)).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(deleteCalendarBlock).not.toHaveBeenCalled();
  });
});
