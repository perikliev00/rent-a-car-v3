import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { resendVerification } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../api/client';

export function EmailUnverifiedBanner() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user || user.emailVerified !== false) {
    return null;
  }

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
    <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm">
      <p className="font-medium text-[var(--color-ink)]">Verify your email to link guest bookings</p>
      <p className="mt-1 text-[var(--color-muted)]">
        Reservations made as a guest will not appear until you confirm{' '}
        <span className="font-medium text-[var(--color-ink)]">{user.email}</span>.{' '}
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
