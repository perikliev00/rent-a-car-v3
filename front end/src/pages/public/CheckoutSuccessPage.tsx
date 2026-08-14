import { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { checkoutSuccess } from '../../api/checkout';
import { StaticPageHero } from '../../components/static/StaticPageHero';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Loading';

export function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['checkout-success', sessionId],
    queryFn: () => checkoutSuccess(sessionId!),
    enabled: !!sessionId,
    // Keep polling while payment is received but booking is not yet confirmed.
    refetchInterval: (query) => {
      const current = query.state.data;
      if (!current || current.confirmed) return false;
      return 2_000;
    },
  });

  useEffect(() => {
    if (!sessionId) return;
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div>
        <StaticPageHero
          title="No payment session"
          description="No payment session found."
        />
        <div className="mx-auto max-w-lg px-4 py-12 text-center sm:px-6">
          <Link to="/">
            <Button size="lg">Go home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <div>
        <StaticPageHero
          title="Payment verification failed"
          description="We could not confirm your payment. You can try again from home or contact support."
        />
        <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
          <div className="rounded-2xl border border-[var(--color-danger)]/25 bg-[var(--color-surface-elevated)] px-6 py-8 text-center shadow-[var(--shadow-soft)]">
            <p className="text-[var(--color-danger)]">{(error as Error).message}</p>
            <Link to="/">
              <Button className="mt-6">Go home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StaticPageHero
        title={data?.title ?? 'Booking confirmed'}
        description={data?.message}
        eyebrow="Confirmed"
      />
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <div className="animate-lux-rise rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-6 py-10 text-center shadow-[var(--shadow-soft)] sm:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-[var(--color-success)]">
            ✓
          </div>

          {data?.orderReference && (
            <p className="mt-6 font-display text-lg font-semibold text-[var(--color-accent-ink)]">
              {data.orderReference}
            </p>
          )}

          {data?.pickupSummary && (
            <p className="mt-2 text-sm text-[var(--color-muted)]">Pickup: {data.pickupSummary}</p>
          )}

          <p className="mt-4 text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
            Status: {data?.bookingStatus}
          </p>

          <div className="mt-6 text-sm text-[var(--color-muted)]">
            <p>Need help? Contact us at {data?.supportEmail}</p>
            {data?.supportPhone && <p>or call {data.supportPhone}</p>}
          </div>

          <Link to="/">
            <Button className="mt-8" size="lg">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
