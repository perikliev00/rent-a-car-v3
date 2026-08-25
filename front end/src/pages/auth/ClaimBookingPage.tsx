import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { AuthPageShell } from '../../components/static/AuthPageShell';
import { Button } from '../../components/ui/Button';
import { ErrorAlert } from '../../components/ui/Toast';
import { Spinner } from '../../components/ui/Loading';
import { ApiError } from '../../api/client';
import { claimReservation } from '../../api/account';

type Status =
  | 'claiming'
  | 'claimed'
  | 'alreadyOwned'
  | 'invalid'
  | 'conflict'
  | 'missing'
  | 'needsLogin'
  | 'needsVerification';

export function ClaimBookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading, emailVerified } = useAuth();
  const [status, setStatus] = useState<Status>('claiming');
  const [reservationId, setReservationId] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (isLoading || attempted.current) return;

    const token = searchParams.get('token');
    const id = searchParams.get('reservationId');
    setReservationId(id);

    if (!token || !id) {
      attempted.current = true;
      setStatus('missing');
      return;
    }

    if (!user) {
      // Keep the token in the URL so the claim can resume after logging in; nothing is
      // written to storage.
      setStatus('needsLogin');
      return;
    }

    if (!emailVerified) {
      setStatus('needsVerification');
      return;
    }

    attempted.current = true;

    // Strip the token from the address bar before the request settles, so it does not
    // linger in history or referrers.
    navigate('/claim-booking', { replace: true });

    claimReservation(id, token)
      .then((result) => {
        setStatus(result.alreadyOwned ? 'alreadyOwned' : 'claimed');
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === 'CLAIM_CONFLICT') {
          setStatus('conflict');
          return;
        }
        setStatus('invalid');
      });
  }, [emailVerified, isLoading, navigate, searchParams, user]);

  if (isLoading || status === 'claiming') {
    return (
      <AuthPageShell title="Adding your booking" subtitle="This only takes a moment">
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </AuthPageShell>
    );
  }

  if (status === 'needsLogin') {
    return (
      <AuthPageShell
        title="Log in to add this booking"
        subtitle="Use the email address the booking was made with"
      >
        <p className="text-sm text-[var(--color-muted)]">
          For your security, a booking can only be added to an account with the same,
          confirmed email address. Log in or sign up with that address, then open this link
          again.
        </p>
        <div className="mt-6 space-y-3">
          <Button className="w-full" onClick={() => navigate('/login')}>
            Log in
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate('/signup')}>
            Create an account
          </Button>
        </div>
      </AuthPageShell>
    );
  }

  if (status === 'needsVerification') {
    return (
      <AuthPageShell title="Confirm your email first" subtitle="Then this booking can be added">
        <p className="text-sm text-[var(--color-muted)]">
          A booking can only be added once your account email address is confirmed. Confirm
          it, then open this link again.
        </p>
        <Button className="mt-6 w-full" onClick={() => navigate('/account/verify-email')}>
          Confirm my email
        </Button>
      </AuthPageShell>
    );
  }

  if (status === 'claimed' || status === 'alreadyOwned') {
    return (
      <AuthPageShell
        title={status === 'claimed' ? 'Booking added' : 'Booking already in your account'}
        subtitle="It is available in your bookings"
        sideTitle="Everything in one place"
        sideDescription="Manage travel details, download invoices, and request changes from your account."
      >
        <p className="text-sm text-[var(--color-muted)]">
          {status === 'claimed'
            ? 'This booking is now linked to your account.'
            : 'This booking was already linked to your account, so nothing changed.'}
        </p>
        <Button
          className="mt-6 w-full"
          onClick={() =>
            navigate(reservationId ? `/account/reservations/${reservationId}` : '/account/reservations')
          }
        >
          View my booking
        </Button>
      </AuthPageShell>
    );
  }

  if (status === 'conflict') {
    return (
      <AuthPageShell title="Already linked elsewhere" subtitle="We could not add this booking">
        <ErrorAlert message="This booking is already linked to a different account." />
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          We never move a booking between accounts. If you believe this is a mistake, contact
          support and we will look into it.
        </p>
        <Link
          to="/contact"
          className="mt-6 inline-block text-sm font-medium text-[var(--color-accent-ink)] hover:underline"
        >
          Contact support
        </Link>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell title="This link is not valid" subtitle="We could not add this booking">
      <ErrorAlert
        message={
          status === 'missing'
            ? 'This link is incomplete.'
            : 'This link is invalid, has expired, has already been used, or was issued for a different email address.'
        }
      />
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        You can request a new link from your account, and we will email it to the address the
        booking was made with.
      </p>
      <Button className="mt-6 w-full" onClick={() => navigate('/account/reservations')}>
        Go to my bookings
      </Button>
    </AuthPageShell>
  );
}
