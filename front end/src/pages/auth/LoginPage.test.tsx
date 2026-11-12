import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import { renderWithAuth } from '../../test/test-utils';
import { LoginPage } from './LoginPage';

vi.mock('../../api/auth', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.getMe).mockResolvedValue(null);
  });

  it('renders login form', async () => {
    renderWithAuth(<LoginPage />, { route: '/login', path: '/login' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });
});
