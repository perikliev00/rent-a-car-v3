import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../auth/useAuth';
import { renderWithRouter } from '../../test/test-utils';
import { PublicLayout } from './PublicLayout';

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function renderPublicLayout(route = '/') {
  return renderWithRouter(
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<div>Page content</div>} />
        <Route path="about" element={<div>About page content</div>} />
      </Route>
    </Routes>,
    { route },
  );
}

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

    renderPublicLayout();

    expect(screen.getByRole('link', { name: /LuxRide/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.getByTestId('public-mobile-menu')).toBeInTheDocument();
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

    renderPublicLayout();

    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('opens the mobile drawer and closes it after navigation', async () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderPublicLayout();

    fireEvent.click(screen.getByTestId('public-mobile-menu'));
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(drawer).getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('link', { name: 'About' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('About page content')).toBeInTheDocument();
  });

  it('closes the mobile drawer from the Close control', async () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderPublicLayout();

    fireEvent.click(screen.getByTestId('public-mobile-menu'));
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    });
  });
});
