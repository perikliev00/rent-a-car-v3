import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import * as accountApi from '../../api/account';
import { ApiError } from '../../api/client';
import { renderWithAuth } from '../../test/test-utils';
import { ClaimBookingPage } from './ClaimBookingPage';

vi.mock('../../api/auth', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock('../../api/account', () => ({
  claimReservation: vi.fn(),
  requestClaimLink: vi.fn(),
}));

const TOKEN = 'c'.repeat(64);

const verifiedUser = {
  id: '1',
  email: 'guest@example.com',
  role: 'user' as const,
  emailVerified: true,
};

function renderPage() {
  return renderWithAuth(<ClaimBookingPage />, {
    route: `/claim-booking?reservationId=10&token=${TOKEN}`,
    path: '/claim-booking',
  });
}

describe('ClaimBookingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims the booking for a verified signed-in user', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ user: verifiedUser });
    vi.mocked(accountApi.claimReservation).mockResolvedValue({
      reservationId: '10',
      claimed: true,
      alreadyOwned: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Booking added' })).toBeInTheDocument();
    });
    expect(accountApi.claimReservation).toHaveBeenCalledWith('10', TOKEN);
  });

  it('asks an anonymous visitor to log in without calling the API', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(null);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Log in to add this booking' }),
      ).toBeInTheDocument();
    });
    expect(accountApi.claimReservation).not.toHaveBeenCalled();
  });

  it('requires a confirmed email before claiming', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({
      user: { ...verifiedUser, emailVerified: false },
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Confirm your email first' }),
      ).toBeInTheDocument();
    });
    expect(accountApi.claimReservation).not.toHaveBeenCalled();
  });

  it('shows a conflict distinctly when another account owns the booking', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ user: verifiedUser });
    vi.mocked(accountApi.claimReservation).mockRejectedValue(
      new ApiError('CLAIM_CONFLICT', 'Already linked', 409),
    );

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Already linked elsewhere' }),
      ).toBeInTheDocument();
    });
  });

  it('shows one generic failure for invalid, expired and mismatched tokens', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ user: verifiedUser });
    vi.mocked(accountApi.claimReservation).mockRejectedValue(
      new ApiError('CLAIM_TOKEN_INVALID', 'Not valid', 400),
    );

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'This link is not valid' }),
      ).toBeInTheDocument();
    });
  });

  it('never writes the token to browser storage', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ user: verifiedUser });
    vi.mocked(accountApi.claimReservation).mockResolvedValue({
      reservationId: '10',
      claimed: true,
      alreadyOwned: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Booking added' })).toBeInTheDocument();
    });

    expect(JSON.stringify(localStorage)).not.toContain(TOKEN);
    expect(JSON.stringify(sessionStorage)).not.toContain(TOKEN);
  });
});
