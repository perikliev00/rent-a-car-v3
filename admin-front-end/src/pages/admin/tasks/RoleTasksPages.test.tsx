import { screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { useAuth } from '../../../auth/useAuth';
import { listCalendarTasks } from '../../../api/admin/calendar';
import { DriverTasksPage } from './RoleTasksPages';

vi.mock('../../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../../api/admin/calendar', () => ({
  listCalendarTasks: vi.fn(),
  updateCalendarTaskStatus: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function renderDriverPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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

describe('DriverTasksPage', () => {
  beforeEach(() => {
    vi.mocked(listCalendarTasks).mockResolvedValue({
      tasks: [
        {
          id: '1',
          title: 'Airport pickup',
          taskType: 'pickup',
          status: 'assigned',
          carId: '2',
          carName: 'BMW',
          reservationId: null,
          notes: null,
          locationText: 'Terminal 1',
          startsAt: null,
          dueAt: new Date().toISOString(),
          assignedToUserId: '9',
          createdByUserId: '1',
          completedAt: null,
        },
      ],
    });
  });

  it('renders assigned driver tasks', async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: '9',
        email: 'driver@example.com',
        role: 'staff',
        roles: ['driver'],
        permissions: ['can_view_own_calendar_tasks'],
      },
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderDriverPage();

    expect(await screen.findByText('Driver tasks')).toBeInTheDocument();
    expect(await screen.findByText('Airport pickup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });
});
