import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { AuthPageShell } from '../../components/static/AuthPageShell';
import { Button } from '../../components/ui/Button';
import { ErrorAlert } from '../../components/ui/Toast';
import { Spinner } from '../../components/ui/Loading';
import { ApiError } from '../../api/client';
import * as authApi from '../../api/auth';

type Status = 'verifying' | 'verified' | 'expired' | 'invalid' | 'missing';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setStatus('missing');
      return;
    }

    // Drop the token from the address bar as soon as it has been read, so it does not end
    // up in history, referrers, or analytics.
    navigate('/verify-email', { replace: true });

    authApi
      .verifyEmail(token)
      .then(async () => {
        setStatus('verified');
        // Pick up the now-verified session so the portal unlocks without a re-login.
        await refresh().catch(() => {});
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === 'VERIFICATION_TOKEN_EXPIRED') {
          setStatus('expired');
          return;
        }
        setStatus('invalid');
      });
  }, [navigate, refresh, searchParams]);

  if (status === 'verifying') {
    return (
      <AuthPageShell title="Confirming your email" subtitle="This only takes a moment">
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </AuthPageShell>
    );
  }

  if (status === 'verified') {
    return (
      <AuthPageShell
        title="Email confirmed"
        subtitle="Your account is ready"
        sideTitle="You're all set"
        sideDescription="Your bookings and documents are now available in your account."
      >
        <p className="text-sm text-[var(--color-muted)]">
          Thanks for confirming your email address. You can now view your bookings and add a
          guest booking to this account.
        </p>
        <Button
          className="mt-6 w-full"
          onClick={() => navigate(user ? '/account' : '/login', { replace: true })}
        >
          {user ? 'Go to my account' : 'Log in'}
        </Button>
      </AuthPageShell>
    );
  }

  const expired = status === 'expired';
  const heading = expired ? 'This link has expired' : 'This link is not valid';
  const message = expired
    ? 'Confirmation links are valid for 24 hours. Request a new one and we will email it to you.'
    : 'This confirmation link is invalid or has already been used. Request a new one and we will email it to you.';

  return (
    <AuthPageShell title={heading} subtitle="Request a new confirmation link">
      <ErrorAlert message={status === 'missing' ? 'No confirmation token was provided.' : message} />
      <div className="mt-6 space-y-3">
        {user ? (
          <Button className="w-full" onClick={() => navigate('/account/verify-email')}>
            Request a new link
          </Button>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            <Link
              to="/login"
              className="font-medium text-[var(--color-accent-ink)] hover:underline"
            >
              Log in
            </Link>{' '}
            to request a new confirmation link.
          </p>
        )}
      </div>
    </AuthPageShell>
  );
}
