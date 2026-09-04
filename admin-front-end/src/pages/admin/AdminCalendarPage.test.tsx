import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminCalendarPage } from './AdminCalendarPage';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      email: 'admin@example.com',
      role: 'admin',
      roles: ['owner'],
      permissions: [
        'can_view_calendar',
        'can_move_calendar_reservations',
        'can_resize_calendar_reservations',
        'can_create_calendar_tasks',
        'can_create_calendar_blocks',
        'can_view_reservations_ops',
      ],
    },
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../../api/admin/calendar', () => ({
  getCalendarEvents: vi.fn().mockResolvedValue({
    cars: [
      {
        id: '1',
        name: 'Test Car',
        status: 'available',
        transmission: 'Auto',
        fuelType: 'Petrol',
        currentLocation: null,
        categoryId: null,
        categoryName: null,
      },
    ],
    events: [
      {
        id: 'reservation:1',
        type: 'reservation',
        carId: '1',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 86400000).toISOString(),
        title: 'Test booking',
        reservationId: '1',
      },
    ],
    density: 'timeline',
  }),
  getCalendarDay: vi.fn(),
  getCalendarEventDetails: vi.fn().mockResolvedValue({
    type: 'reservation',
    reservation: {
      id: '42',
      fullName: 'Ada',
      email: 'ada@example.com',
      status: 'confirmed',
      carName: 'Test Car',
      carId: '1',
      pickupDate: new Date().toISOString(),
      returnDate: new Date(Date.now() + 86400000).toISOString(),
    },
    actions: { canMove: true, canMarkPickup: false, canMarkReturn: false },
    documents: [],
    auditHistory: [],
  }),
  moveCalendarEvent: vi.fn(),
  resizeCalendarEvent: vi.fn(),
  createCalendarTask: vi.fn(),
  createCalendarBlock: vi.fn(),
  updateCalendarTask: vi.fn(),
  updateCalendarBlock: vi.fn(),
  deleteCalendarTask: vi.fn(),
  deleteCalendarBlock: vi.fn(),
  cancelCalendarReservation: vi.fn(),
  updateCalendarTaskStatus: vi.fn(),
  getAssignableStaff: vi.fn().mockResolvedValue({ users: [] }),
  listCalendarTasks: vi.fn().mockResolvedValue({ tasks: [] }),
}));

vi.mock('../../api/admin/reservations', () => ({
  changeReservationStatus: vi.fn(),
}));

function renderPage(entry: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <AdminCalendarPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdminCalendarPage', () => {
  it('renders fleet calendar heading, legend, and timeline car', async () => {
    renderPage('/admin/calendar?view=week');

    expect(screen.getByRole('heading', { name: /Fleet calendar/i })).toBeInTheDocument();
    expect(await screen.findByTestId('calendar-legend')).toBeInTheDocument();
    expect(await screen.findByText('Test Car')).toBeInTheDocument();
  });

  it('renders month fleet grid in month view', async () => {
    renderPage('/admin/calendar?view=month&date=2026-08-01');

    expect(await screen.findByTestId('month-fleet-grid')).toBeInTheDocument();
    expect(await screen.findByText('Test Car')).toBeInTheDocument();
  });

  it('opens quick create menu on empty slot click', async () => {
    renderPage('/admin/calendar?view=week');
    await screen.findByText('Test Car');
    const tracks = document.querySelectorAll('[data-track="1"]');
    expect(tracks.length).toBeGreaterThan(0);
    fireEvent.click(tracks[0]);
    expect(await screen.findByTestId('quick-create-menu')).toBeInTheDocument();
  });

  it('drawer open reservation deep-links with id', async () => {
    renderPage('/admin/calendar?view=week');
    const booking = await screen.findByText(/Test booking/i);
    fireEvent.click(booking);
    const openBtn = await screen.findByTestId('open-reservation-ops');
    expect(openBtn).toBeInTheDocument();
    // Button navigates to ops with id — href check via parent link sibling
    expect(screen.getByRole('link', { name: /Open in new tab/i })).toHaveAttribute(
      'href',
      '/admin/reservations?id=42'
    );
  });
});
