/**
 * Account banner shown until email is verified.
 * Guest bookings only link to the account after verification, so this nudge matters.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { resendVerification } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../api/client';

/**
 * Inline prompt + resend for unverified accounts; renders nothing once verified.
 *
 * @returns Banner UI, or `null` when there is no user or email is already verified.
 * @remarks Side effect: `handleResend` calls the resend-verification API.
 */
export function EmailUnverifiedBanner() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only show when the API explicitly reports unverified (not when the field is absent).
  if (!user || user.emailVerified !== false) {
    return null;
  }

  /** Request another verification email and surface success/error inline. */
  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      await resendVerification();
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not send the verification email.');
      }
    } finally {
      setLoading(false);
    }
  };

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
