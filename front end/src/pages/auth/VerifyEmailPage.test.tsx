import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/client';
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

const TOKEN = 'a'.repeat(64);

function renderPage(search: string) {
  return renderWithAuth(<VerifyEmailPage />, {
    route: `/verify-email${search}`,
    path: '/verify-email',
  });
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getMe).mockResolvedValue(null);
  });

  it('confirms the email and shows success', async () => {
    vi.mocked(authApi.verifyEmail).mockResolvedValue({
      emailVerified: true,
      alreadyVerified: false,
    });

    renderPage(`?token=${TOKEN}`);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument();
    });
    expect(authApi.verifyEmail).toHaveBeenCalledWith(TOKEN);
  });

  it('reports an expired link distinctly', async () => {
    vi.mocked(authApi.verifyEmail).mockRejectedValue(
      new ApiError('VERIFICATION_TOKEN_EXPIRED', 'Expired', 410),
    );

    renderPage(`?token=${TOKEN}`);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
    });
  });

  it('reports invalid, used and revoked links the same way', async () => {
    vi.mocked(authApi.verifyEmail).mockRejectedValue(
      new ApiError('VERIFICATION_TOKEN_INVALID', 'Invalid', 400),
    );

    renderPage(`?token=${TOKEN}`);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'This link is not valid' }),
      ).toBeInTheDocument();
    });
  });

  it('does not call the API without a token', async () => {
    renderPage('');

    await waitFor(() => {
      expect(screen.getByText('No confirmation token was provided.')).toBeInTheDocument();
    });
    expect(authApi.verifyEmail).not.toHaveBeenCalled();
  });

  it('never writes the token to browser storage', async () => {
    vi.mocked(authApi.verifyEmail).mockResolvedValue({
      emailVerified: true,
      alreadyVerified: false,
    });

    renderPage(`?token=${TOKEN}`);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument();
    });

    expect(JSON.stringify(localStorage)).not.toContain(TOKEN);
    expect(JSON.stringify(sessionStorage)).not.toContain(TOKEN);
  });
});
