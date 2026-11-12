import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import { renderWithAuth } from '../../test/test-utils';
import { SignupPage } from './SignupPage';

vi.mock('../../api/auth', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
}));

describe('SignupPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.getMe).mockResolvedValue(null);
  });

  it('renders signup form', async () => {
    renderWithAuth(<SignupPage />, { route: '/signup', path: '/signup' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
  });
});
