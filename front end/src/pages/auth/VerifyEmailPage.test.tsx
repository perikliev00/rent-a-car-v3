import { screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
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

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getMe).mockResolvedValue(null);
  });

  it('prompts the user to check email when no token is present', async () => {
    renderWithAuth(<VerifyEmailPage />, { route: '/verify-email', path: '/verify-email' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    });

    expect(authApi.verifyEmail).not.toHaveBeenCalled();
  });

  it('verifies once under Strict Mode and navigates to account', async () => {
    const token = 'a'.repeat(64);
    vi.mocked(authApi.verifyEmail).mockResolvedValue({
      user: { id: '1', email: 'a@b.com', role: 'user', emailVerified: true },
    });
    vi.mocked(authApi.getMe).mockResolvedValue({
      user: { id: '1', email: 'a@b.com', role: 'user', emailVerified: true },
    });

    renderWithAuth(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
      { route: `/verify-email?token=${token}`, path: '/verify-email' },
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/account', { replace: true });
    });

    expect(authApi.verifyEmail).toHaveBeenCalledTimes(1);
    expect(authApi.verifyEmail).toHaveBeenCalledWith(token);
  });
});
