import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../auth/useAuth';
import { renderWithRouter } from '../../test/test-utils';
import { PublicLayout } from './PublicLayout';

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('PublicLayout', () => {
  it('renders header nav and child route for guests', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderWithRouter(
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<div>Page content</div>} />
        </Route>
      </Routes>,
    );

    expect(screen.getByRole('link', { name: /LuxRide/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('shows logout for authenticated users', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'user@example.com', role: 'user' },
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderWithRouter(
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<div>Page content</div>} />
        </Route>
      </Routes>,
    );

    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });
});
