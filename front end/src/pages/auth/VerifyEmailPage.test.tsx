import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import { renderWithAuth } from '../../test/test-utils';
import { VerifyEmailPage } from './VerifyEmailPage';

vi.mock('../../api/auth', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.getMe).mockResolvedValue(null);
  });

  it('prompts the user to check email when no token is present', async () => {
    renderWithAuth(<VerifyEmailPage />, { route: '/verify-email', path: '/verify-email' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    });

    expect(authApi.verifyEmail).not.toHaveBeenCalled();
  });
});
