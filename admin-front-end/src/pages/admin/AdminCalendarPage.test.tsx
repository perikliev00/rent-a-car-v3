// Load side effects from '@testing-library/jest-dom/vitest'.
import '@testing-library/jest-dom/vitest';
// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '@testing-library/react'.
import { render, screen, fireEvent } from '@testing-library/react';
// Import named exports from 'react-router-dom'.
import { MemoryRouter } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import named exports from './AdminCalendarPage'.
import { AdminCalendarPage } from './AdminCalendarPage';

// Call vi.mock to perform this step.
vi.mock('../../auth/useAuth', () => ({
  // Provide the use auth field value.
  useAuth: () => ({
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
        'can_view_calendar',
        // Supply the literal value used by the enclosing expression.
        'can_move_calendar_reservations',
        // Supply the literal value used by the enclosing expression.
        'can_resize_calendar_reservations',
        // Supply the literal value used by the enclosing expression.
        'can_create_calendar_tasks',
        // Supply the literal value used by the enclosing expression.
        'can_create_calendar_blocks',
        // Supply the literal value used by the enclosing expression.
        'can_view_reservations_ops',
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
  }),
}));

// Call vi.mock to perform this step.
vi.mock('../../api/admin/calendar', () => ({
  // Provide the get calendar events field value.
  getCalendarEvents: vi.fn().mockResolvedValue({
    // Provide the cars field value.
    cars: [
      {
        // Provide the id field value.
        id: '1',
        // Provide the name field value.
        name: 'Test Car',
        // Provide the status field value.
        status: 'available',
        // Provide the transmission field value.
        transmission: 'Auto',
        // Provide the fuel type field value.
        fuelType: 'Petrol',
        // Provide the current location field value.
        currentLocation: null,
        // Provide the category id field value.
        categoryId: null,
        // Provide the category name field value.
        categoryName: null,
      },
    ],
    // Provide the events field value.
    events: [
      {
        // Provide the id field value.
        id: 'reservation:1',
        // Provide the type field value.
        type: 'reservation',
        // Provide the car id field value.
        carId: '1',
        // Provide the start field value.
        start: new Date().toISOString(),
        // Provide the end field value.
        end: new Date(Date.now() + 86400000).toISOString(),
        // Provide the title field value.
        title: 'Test booking',
        // Provide the reservation id field value.
        reservationId: '1',
      },
    ],
    // Provide the density field value.
    density: 'timeline',
  }),
  // Provide the get calendar day field value.
  getCalendarDay: vi.fn(),
  // Provide the get calendar event details field value.
  getCalendarEventDetails: vi.fn().mockResolvedValue({
    // Provide the type field value.
    type: 'reservation',
    // Provide the reservation field value.
    reservation: {
      // Provide the id field value.
      id: '42',
      // Provide the full name field value.
      fullName: 'Ada',
      // Provide the email field value.
      email: 'ada@example.com',
      // Provide the status field value.
      status: 'confirmed',
      // Provide the car name field value.
      carName: 'Test Car',
      // Provide the car id field value.
      carId: '1',
      // Provide the pickup date field value.
      pickupDate: new Date().toISOString(),
      // Provide the return date field value.
      returnDate: new Date(Date.now() + 86400000).toISOString(),
    },
    // Provide the actions field value.
    actions: { canMove: true, canMarkPickup: false, canMarkReturn: false },
    // Provide the documents field value.
    documents: [],
    // Provide the audit history field value.
    auditHistory: [],
  }),
  // Provide the move calendar event field value.
  moveCalendarEvent: vi.fn(),
  // Provide the resize calendar event field value.
  resizeCalendarEvent: vi.fn(),
  // Provide the create calendar task field value.
  createCalendarTask: vi.fn(),
  // Provide the create calendar block field value.
  createCalendarBlock: vi.fn(),
  // Provide the update calendar task field value.
  updateCalendarTask: vi.fn(),
  // Provide the update calendar block field value.
  updateCalendarBlock: vi.fn(),
  // Provide the delete calendar task field value.
  deleteCalendarTask: vi.fn(),
  // Provide the delete calendar block field value.
  deleteCalendarBlock: vi.fn(),
  // Provide the cancel calendar reservation field value.
  cancelCalendarReservation: vi.fn(),
  // Provide the update calendar task status field value.
  updateCalendarTaskStatus: vi.fn(),
  // Provide the get assignable staff field value.
  getAssignableStaff: vi.fn().mockResolvedValue({ users: [] }),
  // Provide the list calendar tasks field value.
  listCalendarTasks: vi.fn().mockResolvedValue({ tasks: [] }),
}));

// Call vi.mock to perform this step.
vi.mock('../../api/admin/reservations', () => ({
  // Provide the change reservation status field value.
  changeReservationStatus: vi.fn(),
}));

// Define the renderPage function.
function renderPage(entry: string) {
  // Create the client constant.
  const client = new QueryClient({
    // Provide the default options field value.
    defaultOptions: { queries: { retry: false } },
  });
  // Return the resulting value to the caller.
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <AdminCalendarPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Declare a test suite grouping related cases.
describe('AdminCalendarPage', () => {
  // Define a single test case and its expectations.
  it('renders fleet calendar heading, legend, and timeline car', async () => {
    // Call renderPage to perform this step.
    renderPage('/admin/calendar?view=week');

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('heading', { name: /Fleet calendar/i })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(await screen.findByTestId('calendar-legend')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(await screen.findByText('Test Car')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('renders month fleet grid in month view', async () => {
    // Call renderPage to perform this step.
    renderPage('/admin/calendar?view=month&date=2026-08-01');

    // Assert that the value matches the intended expectation.
    expect(await screen.findByTestId('month-fleet-grid')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(await screen.findByText('Test Car')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('opens quick create menu on empty slot click', async () => {
    // Call renderPage to perform this step.
    renderPage('/admin/calendar?view=week');
    // Wait until the asynchronous operation resolves.
    await screen.findByText('Test Car');
    // Create the tracks constant.
    const tracks = document.querySelectorAll('[data-track="1"]');
    // Assert that the value matches the intended expectation.
    expect(tracks.length).toBeGreaterThan(0);
    // Call fireEvent.click to perform this step.
    fireEvent.click(tracks[0]);
    // Assert that the value matches the intended expectation.
    expect(await screen.findByTestId('quick-create-menu')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('drawer open reservation deep-links with id', async () => {
    // Call renderPage to perform this step.
    renderPage('/admin/calendar?view=week');
    // Create the booking constant.
    const booking = await screen.findByText(/Test booking/i);
    // Call fireEvent.click to perform this step.
    fireEvent.click(booking);
    // Create the open btn constant.
    const openBtn = await screen.findByTestId('open-reservation-ops');
    // Assert that the value matches the intended expectation.
    expect(openBtn).toBeInTheDocument();
    // Button navigates to ops with id — href check via parent link sibling
    expect(screen.getByRole('link', { name: /Open in new tab/i })).toHaveAttribute(
      // Supply the literal value used by the enclosing expression.
      'href',
      // Continue the surrounding logic with this statement.
      '/admin/reservations?id=42'
    );
  });
});
