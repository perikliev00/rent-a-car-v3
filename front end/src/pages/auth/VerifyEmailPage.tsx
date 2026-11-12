/**
 * Email verification UI. When `?token=` is present, consumes the one-time token
 * (deduped across Strict Mode remounts). Otherwise offers a resend for signed-in users.
 */
import { useEffect, useRef, useState } from 'react';
// Import named exports from 'react-router-dom'.
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../api/auth'.
import { resendVerification, verifyEmail } from '../../api/auth';
// Import named exports from '../../components/static/AuthPageShell'.
import { AuthPageShell } from '../../components/static/AuthPageShell';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Toast'.
import { ErrorAlert } from '../../components/ui/Toast';
// Import named exports from '../../api/client'.
import { ApiError } from '../../api/client';

/**
 * Verify-email landing and resend controls.
 *
 * @returns Auth shell that either auto-verifies a token or offers resend/login CTAs.
 * @remarks Side effects: consumes a one-time verify token; may refresh session and navigate to `/account`.
 */
export function VerifyEmailPage() {
  // Destructure object properties into local variables.
  const { user, refresh } = useAuth();
  // Create the navigate constant.
  const navigate = useNavigate();
  // Destructure array values into local variables.
  const [searchParams] = useSearchParams();
  // Create the token constant.
  const token = searchParams.get('token')?.trim() || '';

  // Destructure array values into local variables.
  const [error, setError] = useState('');
  // Destructure array values into local variables.
  const [status, setStatus] = useState<'idle' | 'verifying' | 'sending'>(
    // Contribute this line to the enclosing declaration or statement.
    token ? 'verifying' : 'idle'
  );

  // Share one in-flight verify per token so React Strict Mode remounts do not
  // consume the one-time token twice and cancel navigation.
  const verifyRequestRef = useRef<{ token: string; promise: Promise<void> } | null>(null);

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!token) return;

    // Ignore late resolutions after unmount / token change.
    let ignore = false;
    // Call setStatus to perform this step.
    setStatus('verifying');
    // Call setError to perform this step.
    setError('');

    // Start a new request only when the token changes.
    if (!verifyRequestRef.current || verifyRequestRef.current.token !== token) {
      // Update verifyRequestRef.current with the right-hand side value.
      verifyRequestRef.current = {
        // Contribute this line to the enclosing declaration or statement.
        token,
        // Provide the promise field value.
        promise: verifyEmail(token).then(async () => {
          // Wait until the asynchronous operation resolves.
          await refresh();
        }),
      };
    }

    // Contribute this line to the enclosing declaration or statement.
    verifyRequestRef.current.promise
      // Call .then to perform this step.
      .then(() => {
        // Evaluate the condition and enter the branch when it is true.
        if (ignore) return;
        // Call navigate to perform this step.
        navigate('/account', { replace: true });
      })
      // Call .catch to perform this step.
      .catch((err) => {
        // Evaluate the condition and enter the branch when it is true.
        if (ignore) return;
        // Clear the shared promise so a retry can run.
        if (verifyRequestRef.current?.token === token) {
          // Update verifyRequestRef.current with the right-hand side value.
          verifyRequestRef.current = null;
        }
        // Call setStatus to perform this step.
        setStatus('idle');
        // Evaluate the condition and enter the branch when it is true.
        if (err instanceof ApiError) {
          // Call setError to perform this step.
          setError(err.message);
        // Contribute this line to the enclosing declaration or statement.
        } else {
          // Call setError to perform this step.
          setError('This verification link is invalid or has expired.');
        }
      });

    // Return the resulting value to the caller.
    return () => {
      // Update ignore with the right-hand side value.
      ignore = true;
    };
  // Continue the surrounding logic with this statement.
  }, [token, refresh, navigate]);

  /** Ask the API to send another verification email to the signed-in user. */
  const handleResend = async () => {
    // Call setError to perform this step.
    setError('');
    // Call setStatus to perform this step.
    setStatus('sending');
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await resendVerification();
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Evaluate the condition and enter the branch when it is true.
      if (err instanceof ApiError) {
        // Call setError to perform this step.
        setError(err.message);
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Call setError to perform this step.
        setError('Could not send the verification email. Please try again.');
      }
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Call setStatus to perform this step.
      setStatus('idle');
    }
  };

  // Create the verifying constant.
  const verifying = status === 'verifying';

  // Return control to the caller with the following value.
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
