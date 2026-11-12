/**
 * Account banner shown until email is verified.
 * Guest bookings only link to the account after verification, so this nudge matters.
 */
import { useState } from 'react';
// Import named exports from 'react-router-dom'.
import { Link } from 'react-router-dom';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../api/auth'.
import { resendVerification } from '../../api/auth';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../api/client'.
import { ApiError } from '../../api/client';

/**
 * Inline prompt + resend for unverified accounts; renders nothing once verified.
 *
 * @returns Banner UI, or `null` when there is no user or email is already verified.
 * @remarks Side effect: `handleResend` calls the resend-verification API.
 */
export function EmailUnverifiedBanner() {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Destructure array values into local variables.
  const [error, setError] = useState('');
  // Destructure array values into local variables.
  const [sent, setSent] = useState(false);
  // Destructure array values into local variables.
  const [loading, setLoading] = useState(false);

  // Only show when the API explicitly reports unverified (not when the field is absent).
  if (!user || user.emailVerified !== false) {
    // Return the resulting value to the caller.
    return null;
  }

  /** Request another verification email and surface success/error inline. */
  const handleResend = async () => {
    // Call setError to perform this step.
    setError('');
    // Call setLoading to perform this step.
    setLoading(true);
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await resendVerification();
      // Call setSent to perform this step.
      setSent(true);
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Evaluate the condition and enter the branch when it is true.
      if (err instanceof ApiError) {
        // Call setError to perform this step.
        setError(err.message);
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Call setError to perform this step.
        setError('Could not send the verification email.');
      }
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Call setLoading to perform this step.
      setLoading(false);
    }
  };

  // Return control to the caller with the following value.
  return (
    <div className="mt-6 min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm">
      <p className="font-medium text-[var(--color-ink)]">Verify your email to link guest bookings</p>
      <p className="mt-1 break-words text-[var(--color-muted)]">
        Reservations made as a guest will not appear until you confirm{' '}
        <span className="break-all font-medium text-[var(--color-ink)]">{user.email}</span>.{' '}
        <Link to="/verify-email" className="font-medium text-[var(--color-accent-ink)] hover:underline">
          Open verification
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" loading={loading} onClick={handleResend}>
          Resend email
        </Button>
        {sent && <span className="text-[var(--color-muted)]">Verification email sent.</span>}
        {error && <span className="text-[var(--color-danger)]">{error}</span>}
      </div>
    </div>
  );
}
