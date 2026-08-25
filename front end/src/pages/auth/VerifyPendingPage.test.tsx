import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import { renderWithAuth } from '../../test/test-utils';
import { VerifyPendingPage } from './VerifyPendingPage';

vi.mock('../../api/auth', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

const unverifiedUser = {
  id: '1',
  email: 'guest@example.com',
  role: 'user' as const,
  emailVerified: false,
};

function renderPage() {
  return renderWithAuth(<VerifyPendingPage />, {
    route: '/account/verify-email',
    path: '/account/verify-email',
  });
}

describe('VerifyPendingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.getMe).mockResolvedValue({ user: unverifiedUser });
    vi.mocked(authApi.resendVerification).mockResolvedValue({
      requested: true,
      emailVerified: false,
    });
  });

  it('shows the pending state with the account email', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Confirm your email' })).toBeInTheDocument();
    });
    expect(screen.getByText('We sent a link to guest@example.com')).toBeInTheDocument();
  });

  it('resends the link and then blocks further requests during the cooldown', async () => {
    renderPage();

    const button = await screen.findByRole('button', { name: 'Resend confirmation link' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(authApi.resendVerification).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Resend available in/ })).toBeDisabled();
    });
  });
});
