// Import named exports from '@testing-library/react'.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
// Import named exports from 'react-router-dom'.
import { Route, Routes } from 'react-router-dom';
// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './PublicLayout'.
import { PublicLayout } from './PublicLayout';

// Call vi.mock to perform this step.
vi.mock('../../auth/useAuth', () => ({
  // Provide the use auth field value.
  useAuth: vi.fn(),
}));

// Create the mocked use auth constant.
const mockedUseAuth = vi.mocked(useAuth);

// Define the renderPublicLayout function.
function renderPublicLayout(route = '/') {
  // Return the resulting value to the caller.
  return renderWithRouter(
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<div>Page content</div>} />
        <Route path="about" element={<div>About page content</div>} />
      </Route>
    </Routes>,
    // Contribute this line to the enclosing declaration or statement.
    { route },
  );
}

// Declare a test suite grouping related cases.
describe('PublicLayout', () => {
  // Define a single test case and its expectations.
  it('renders header nav and child route for guests', () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: null,
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

    // Call renderPublicLayout to perform this step.
    renderPublicLayout();

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('link', { name: /LuxRide/i })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByTestId('public-mobile-menu')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('shows logout for authenticated users', () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: { id: '1', email: 'user@example.com', role: 'user' },
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

    // Call renderPublicLayout to perform this step.
    renderPublicLayout();

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('opens the mobile drawer and closes it after navigation', async () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: null,
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

    // Call renderPublicLayout to perform this step.
    renderPublicLayout();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByTestId('public-mobile-menu'));
    // Create the drawer constant.
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    // Assert that the value matches the intended expectation.
    expect(within(drawer).getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(within(drawer).getByRole('link', { name: 'About' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    });
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('About page content')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('closes the mobile drawer from the Close control', async () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: null,
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

    // Call renderPublicLayout to perform this step.
    renderPublicLayout();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByTestId('public-mobile-menu'));
    // Create the drawer constant.
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    // Call fireEvent.click to perform this step.
    fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    });
  });
});
