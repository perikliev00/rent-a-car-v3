import { useEffect, useRef, useState } from 'react';
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

  // Share one in-flight verify per token so React Strict Mode remounts do not
  // consume the one-time token twice and cancel navigation.
  const verifyRequestRef = useRef<{ token: string; promise: Promise<void> } | null>(null);

  useEffect(() => {
    if (!token) return;

    let ignore = false;
    setStatus('verifying');
    setError('');

    if (!verifyRequestRef.current || verifyRequestRef.current.token !== token) {
      verifyRequestRef.current = {
        token,
        promise: verifyEmail(token).then(async () => {
          await refresh();
        }),
      };
    }

    verifyRequestRef.current.promise
      .then(() => {
        if (ignore) return;
        navigate('/account', { replace: true });
      })
      .catch((err) => {
        if (ignore) return;
        if (verifyRequestRef.current?.token === token) {
          verifyRequestRef.current = null;
        }
        setStatus('idle');
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('This verification link is invalid or has expired.');
        }
      });

    return () => {
      ignore = true;
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
