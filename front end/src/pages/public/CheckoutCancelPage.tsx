import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { checkoutCancel } from '../../api/checkout';
import { StaticPageHero } from '../../components/static/StaticPageHero';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Loading';

export function CheckoutCancelPage() {
  const cancelMutation = useMutation({
    mutationFn: checkoutCancel,
  });

  useEffect(() => {
    cancelMutation.mutate();
    // Intentionally run once on mount to release the hold.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cancelMutation.isPending) return <PageLoader />;

  const data = cancelMutation.data;

  return (
    <div>
      <StaticPageHero
        title="Payment cancelled"
        description="No charge was made for this attempt. Your reservation hold has been released."
        eyebrow="Checkout"
      />
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <div className="animate-lux-rise rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-6 py-10 text-center shadow-[var(--shadow-soft)] sm:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-muted)] font-display text-2xl font-bold text-[var(--color-accent-ink)]">
            !
          </div>
          <p className="mt-6 text-[var(--color-muted)] leading-relaxed">
            {data?.message ??
              'Your payment was cancelled and your reservation hold has been released.'}
          </p>
          {data?.supportEmail && (
            <p className="mt-4 text-sm text-[var(--color-muted)]">
              Questions? Email {data.supportEmail}
            </p>
          )}
          <Link to="/">
            <Button className="mt-8" size="lg">
              Start a new search
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
