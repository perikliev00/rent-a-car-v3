import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

/**
 * Persistent reminder for signed-in accounts whose email is not confirmed yet. Their
 * portal is fail-closed until they confirm, so the state needs to be visible rather than
 * only surfacing as a failed page load.
 */
export function VerificationBanner() {
  const { verificationRequired } = useAuth();

  if (!verificationRequired) {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-6">
        <p>
          Confirm your email address to see your bookings, documents and invoices.
        </p>
        <Link
          to="/account/verify-email"
          className="font-semibold underline decoration-amber-400 underline-offset-2 hover:decoration-amber-700"
        >
          Confirm now
        </Link>
      </div>
    </div>
  );
}
