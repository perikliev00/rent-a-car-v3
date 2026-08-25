import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { AuthPageShell } from '../../components/static/AuthPageShell';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { toast } from '../../components/ui/toastStore';
import { ApiError } from '../../api/client';
import * as authApi from '../../api/auth';

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyPendingPage() {
  const { user, isLoading, emailVerified, refresh } = useAuth();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (isLoading) {
    return (
      <AuthPageShell title="Confirm your email" subtitle="Loading your account">
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </AuthPageShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (emailVerified) {
    return <Navigate to="/account" replace />;
  }

  const handleResend = async () => {
    setSending(true);
    try {
      await authApi.resendVerification();
      // The API answers uniformly whether a mail was sent or throttled, so the UI says the
      // same thing either way.
      toast('If your email still needs confirming, a new link is on its way.', 'success');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        toast('Too many requests. Please wait a moment and try again.', 'error');
      } else {
        toast('Could not send a new confirmation link. Please try again.', 'error');
      }
    } finally {
      setSending(false);
    }
  };

  const handleRecheck = async () => {
    await refresh().catch(() => {});
    navigate('/account');
  };

  return (
    <AuthPageShell
      title="Confirm your email"
      subtitle={`We sent a link to ${user.email}`}
      sideTitle="One quick step"
      sideDescription="Confirming your email keeps your bookings, documents and invoices private to you."
    >
      <p className="text-sm text-[var(--color-muted)]">
        Open the link in that email to unlock your account. Until then, your bookings,
        documents and invoices stay locked — including any guest booking made with this
        address.
      </p>

      <div className="mt-6 space-y-3">
        <Button
          className="w-full"
          loading={sending}
          disabled={cooldown > 0}
          onClick={handleResend}
        >
          {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend confirmation link'}
        </Button>
        <Button variant="secondary" className="w-full" onClick={handleRecheck}>
          I have confirmed my email
        </Button>
      </div>
    </AuthPageShell>
  );
}
