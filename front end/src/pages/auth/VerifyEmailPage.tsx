import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { resendVerification, verifyEmail } from '../../api/auth';
import { AuthPageShell } from '../../components/static/AuthPageShell';
import { Button } from '../../components/ui/Button';
import { ErrorAlert } from '../../components/ui/Toast';
import { ApiError } from '../../api/client';

export function VerifyEmailPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';

  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'sending'>(
    token ? 'verifying' : 'idle'
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setStatus('verifying');
    setError('');

    verifyEmail(token)
      .then(async () => {
        if (cancelled) return;
        await refresh();
        navigate('/account', { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('idle');
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('This verification link is invalid or has expired.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, refresh, navigate]);

  const handleResend = async () => {
    setError('');
    setStatus('sending');
    try {
      await resendVerification();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not send the verification email. Please try again.');
      }
    } finally {
      setStatus('idle');
    }
  };

  const verifying = status === 'verifying';

  return (
    <AuthPageShell
      title={token ? 'Verifying email' : 'Check your email'}
      subtitle={
        token
          ? 'Confirming your email so we can link guest bookings to this account.'
          : 'We sent a verification link to your inbox. Guest bookings stay unlinked until you confirm this address.'
      }
      sideTitle="Confirm it is you."
      sideDescription="Mailbox ownership is required before past guest reservations appear in your account."
    >
      {verifying ? (
        <p className="text-sm text-[var(--color-muted)]">Verifying your email…</p>
      ) : (
        <div className="space-y-4">
          {error && <ErrorAlert message={error} />}
          {user && user.emailVerified !== true && (
            <>
              <p className="text-sm text-[var(--color-muted)]">
                Sent to <span className="font-medium text-[var(--color-ink)]">{user.email}</span>
              </p>
              <Button
                type="button"
                className="w-full"
                loading={status === 'sending'}
                onClick={handleResend}
              >
                Resend verification email
              </Button>
            </>
          )}
          {user?.emailVerified === true && (
            <Link to="/account">
              <Button className="w-full">Go to account</Button>
            </Link>
          )}
          {!user && (
            <p className="text-sm text-[var(--color-muted)]">
              Already confirmed?{' '}
              <Link
                to="/login"
                className="font-medium text-[var(--color-accent-ink)] hover:underline"
              >
                Log in
              </Link>
            </p>
          )}
        </div>
      )}
    </AuthPageShell>
  );
}
