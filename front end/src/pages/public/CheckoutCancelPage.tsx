/**
 * Stripe cancel return URL: notifies the backend once on mount so any active
 * hold can be released, then shows a calm message to restart search.
 */
import { useEffect } from 'react';
// Import named exports from 'react-router-dom'.
import { Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useMutation } from '@tanstack/react-query';
// Import named exports from '../../api/client'.
import { ApiError } from '../../api/client';
// Import named exports from '../../api/checkout'.
import { checkoutCancel } from '../../api/checkout';
// Import named exports from '../../components/static/StaticPageHero'.
import { StaticPageHero } from '../../components/static/StaticPageHero';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';

// Create the noop message constant.
const NOOP_MESSAGE =
  // Continue the surrounding logic with this statement.
  'No active reservation hold to cancel. You can start a new search whenever you are ready.';

/**
 * Shown when the customer abandons Stripe Checkout.
 *
 * @returns Cancel confirmation UI after the cancel API call settles.
 * @remarks Side effect: calls {@link checkoutCancel} once on mount to release any hold.
 */
export function CheckoutCancelPage() {
  // Create the cancel mutation constant.
  const cancelMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: checkoutCancel,
  });

  // Call useEffect to perform this step.
  useEffect(() => {
    // Call cancelMutation.mutate to perform this step.
    cancelMutation.mutate();
    // Intentionally run once on mount to release the hold.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cancelMutation.isPending || cancelMutation.isIdle) return <PageLoader />;

  // Create the data constant.
  const data = cancelMutation.data;
  // Create the error message constant.
  const errorMessage =
    // Contribute this line to the enclosing declaration or statement.
    cancelMutation.error instanceof ApiError
      // Contribute this line to the enclosing declaration or statement.
      ? cancelMutation.error.message
      // Contribute this line to the enclosing declaration or statement.
      : cancelMutation.error instanceof Error
        // Contribute this line to the enclosing declaration or statement.
        ? cancelMutation.error.message
        // Contribute this line to the enclosing declaration or statement.
        : null;
  // Prefer API copy on success; otherwise show the error or a calm no-op message.
  const bodyMessage = cancelMutation.isSuccess
    // Continue the surrounding logic with this statement.
    ? (data?.message ?? NOOP_MESSAGE)
    // Continue the surrounding logic with this statement.
    : (errorMessage || NOOP_MESSAGE);

  // Return control to the caller with the following value.
  return (
    <div>
      <StaticPageHero
        title="Payment cancelled"
        description={
          data?.cancelled
            ? 'No charge was made for this attempt. Your reservation hold has been released.'
            : 'No charge was made for this attempt.'
        }
        eyebrow="Checkout"
      />
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <div className="animate-lux-rise rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-6 py-10 text-center shadow-[var(--shadow-soft)] sm:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-muted)] font-display text-2xl font-bold text-[var(--color-accent-ink)]">
            !
          </div>
          <p
            data-testid="checkout-cancel-message"
            className="mt-6 text-[var(--color-muted)] leading-relaxed"
          >
            {bodyMessage}
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
