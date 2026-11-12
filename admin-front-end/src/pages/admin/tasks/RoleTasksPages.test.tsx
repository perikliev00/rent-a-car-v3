// Import named exports from '@testing-library/react'.
import { screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it, vi, beforeEach } from 'vitest';
// Import named exports from 'react-router-dom'.
import { MemoryRouter, Route, Routes } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import named exports from '@testing-library/react'.
import { render } from '@testing-library/react';
// Import named exports from '../../../auth/useAuth'.
import { useAuth } from '../../../auth/useAuth';
// Import named exports from '../../../api/admin/calendar'.
import { listCalendarTasks } from '../../../api/admin/calendar';
// Import named exports from './RoleTasksPages'.
import { DriverTasksPage } from './RoleTasksPages';

// Call vi.mock to perform this step.
vi.mock('../../../auth/useAuth', () => ({
  // Provide the use auth field value.
  useAuth: vi.fn(),
}));
// Call vi.mock to perform this step.
vi.mock('../../../api/admin/calendar', () => ({
  // Provide the list calendar tasks field value.
  listCalendarTasks: vi.fn(),
  // Provide the update calendar task status field value.
  updateCalendarTaskStatus: vi.fn(),
}));

// Create the mocked use auth constant.
const mockedUseAuth = vi.mocked(useAuth);

// Define the renderDriverPage function.
function renderDriverPage() {
  // Create the query client constant.
  const queryClient = new QueryClient({
    // Provide the default options field value.
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Return the resulting value to the caller.
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/tasks/driver']}>
        <Routes>
          <Route path="/admin/tasks/driver" element={<DriverTasksPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Declare a test suite grouping related cases.
describe('DriverTasksPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(listCalendarTasks).mockResolvedValue({
      // Provide the tasks field value.
      tasks: [
        {
          // Provide the id field value.
          id: '1',
          // Provide the title field value.
          title: 'Airport pickup',
          // Provide the task type field value.
          taskType: 'pickup',
          // Provide the status field value.
          status: 'assigned',
          // Provide the car id field value.
          carId: '2',
          // Provide the car name field value.
          carName: 'BMW',
          // Provide the reservation id field value.
          reservationId: null,
          // Provide the notes field value.
          notes: null,
          // Provide the location text field value.
          locationText: 'Terminal 1',
          // Provide the starts at field value.
          startsAt: null,
          // Provide the due at field value.
          dueAt: new Date().toISOString(),
          // Provide the assigned to user id field value.
          assignedToUserId: '9',
          // Provide the created by user id field value.
          createdByUserId: '1',
          // Provide the completed at field value.
          completedAt: null,
        },
      ],
    });
  });

  // Define a single test case and its expectations.
  it('renders assigned driver tasks', async () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: {
        // Provide the id field value.
        id: '9',
        // Provide the email field value.
        email: 'driver@example.com',
        // Provide the role field value.
        role: 'staff',
        // Provide the roles field value.
        roles: ['driver'],
        // Provide the permissions field value.
        permissions: ['can_view_own_calendar_tasks'],
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

    // Call renderDriverPage to perform this step.
    renderDriverPage();

    // Assert that the value matches the intended expectation.
    expect(await screen.findByText('Driver tasks')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(await screen.findByText('Airport pickup')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });
});
