/**
 * Collects customer contact details and starts Stripe Checkout.
 * Reloads order pricing via `createOrder` so the summary stays aligned with
 * the current URL add-ons; on success, navigates away to the hosted Checkout URL.
 */
import { useMemo, useState } from 'react';
// Import named exports from 'react-router-dom'.
import { useParams, useSearchParams, Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery } from '@tanstack/react-query';
// Import named exports from '../../api/checkout'.
import { startCheckout } from '../../api/checkout';
// Import named exports from '../../components/booking/BookingAddOns'.
import { BookingAddOns } from '../../components/booking/BookingAddOns';
// Import named exports from '../../components/booking/OrderSummary'.
import { OrderSummary } from '../../components/booking/OrderSummary';
// Import named exports from '../../components/ui/Input'.
import { Input } from '../../components/ui/Input';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Toast'.
import { ErrorAlert } from '../../components/ui/Toast';
// Import named exports from '../../api/client'.
import { ApiError } from '../../api/client';
// Import named exports from '../../utils/searchParams'.
import { parseSearchFromUrl, searchParamsToQuery } from '../../utils/searchParams';
// Import named exports from '../../api/orders'.
import { createOrder } from '../../api/orders';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';

/**
 * Checkout form that creates a Stripe session and redirects to payment.
 *
 * @returns Checkout form + order summary, or missing/error fallbacks.
 * @remarks Side effects: refreshes hold via {@link createOrder}; redirects to Stripe on success.
 */
export function CheckoutPage() {
  // Destructure object properties into local variables.
  const { carId } = useParams<{ carId: string }>();
  // Destructure array values into local variables.
  const [searchParams, setSearchParams] = useSearchParams();
  // Create the search constant.
  const search = useMemo(() => parseSearchFromUrl(searchParams), [searchParams]);

  // Create the extras constant.
  const extras = search?.extras || [];
  // Create the hotel delivery constant.
  const hotelDelivery = Boolean(search?.hotelDelivery);

  // Destructure array values into local variables.
  const [form, setForm] = useState({
    // Provide the full name field value.
    fullName: '',
    // Provide the phone number field value.
    phoneNumber: '',
    // Provide the email field value.
    email: '',
    // Provide the address field value.
    address: '',
    // Provide the hotel name field value.
    hotelName: '',
  });
  // Destructure array values into local variables.
  const [error, setError] = useState('');

  // Reuse createOrder so the summary reflects the same hold/pricing as the order step.
  const { data: orderData, isLoading, isError, error: orderError } = useQuery({
    // Provide the query key field value.
    queryKey: ['order-preview', carId, search, extras, hotelDelivery],
    // Provide the query fn field value.
    queryFn: () =>
      // Call createOrder to perform this step.
      createOrder({
        // Provide the car id field value.
        carId: Number(carId),
        // Provide the pickup date field value.
        pickupDate: search!.pickupDate,
        // Provide the return date field value.
        returnDate: search!.returnDate,
        // Provide the pickup location field value.
        pickupLocation: search!.pickupLocation,
        // Provide the return location field value.
        returnLocation: search!.returnLocation,
        // Provide the pickup time field value.
        pickupTime: search!.pickupTime,
        // Provide the return time field value.
        returnTime: search!.returnTime,
        // Contribute this line to the enclosing declaration or statement.
        extras,
        // Contribute this line to the enclosing declaration or statement.
        hotelDelivery,
      }),
    // Provide the enabled field value.
    enabled: !!search && !!carId,
  });

  // Create the checkout mutation constant.
  const checkoutMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
      // Call startCheckout to perform this step.
      startCheckout({
        // Provide the car id field value.
        carId: Number(carId),
        // Provide the pickup date field value.
        pickupDate: search!.pickupDate,
        // Provide the return date field value.
        returnDate: search!.returnDate,
        // Provide the pickup location field value.
        pickupLocation: search!.pickupLocation,
        // Provide the return location field value.
        returnLocation: search!.returnLocation,
        // Provide the pickup time field value.
        pickupTime: search!.pickupTime,
        // Provide the return time field value.
        returnTime: search!.returnTime,
        // Contribute this line to the enclosing declaration or statement.
        extras,
        // Hotel name implies hotel delivery even if the toggle was left off.
        hotelDelivery: hotelDelivery || Boolean(form.hotelName),
        // Spread form into the surrounding structure.
        ...form,
      }),
    // Provide the on success field value.
    onSuccess: (data) => {
      // Full navigation leaves the SPA for Stripe's hosted page.
      window.location.href = data.checkoutUrl;
    },
    // Provide the on error field value.
    onError: (err) => {
      // Evaluate the condition and enter the branch when it is true.
      if (err instanceof ApiError) {
        // Call setError to perform this step.
        setError(err.message);
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Call setError to perform this step.
        setError('Checkout failed. Please try again.');
      }
    },
  });

  /** Persist add-on choices into the URL so pricing stays in sync on refresh. */
  const updateAddOns = (next: { extras: string[]; hotelDelivery: boolean }) => {
    // Evaluate the condition and enter the branch when it is true.
    if (!search) return;
    // Call setSearchParams to perform this step.
    setSearchParams(
      // Call searchParamsToQuery to perform this step.
      searchParamsToQuery({
        // Spread search into the surrounding structure.
        ...search,
        // Provide the extras field value.
        extras: next.extras,
        // Provide the hotel delivery field value.
        hotelDelivery: next.hotelDelivery,
      }),
      // Contribute this line to the enclosing declaration or statement.
      { replace: true }
    );
  };

  // Evaluate the condition and enter the branch when it is true.
  if (!search || !carId) {
    // Return control to the caller with the following value.
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-[var(--color-muted)]">Missing booking details.</p>
        <Link
          to="/"
          className="mt-4 inline-block font-medium text-[var(--color-accent-ink)] hover:underline"
        >
          Start a new search
        </Link>
      </div>
    );
  }

  if (isLoading) return <PageLoader />;

  // Evaluate the condition and enter the branch when it is true.
  if (isError || !orderData) {
    // Create the message constant.
    const message =
      // Contribute this line to the enclosing declaration or statement.
      orderError instanceof ApiError
        // Contribute this line to the enclosing declaration or statement.
        ? orderError.message
        // Contribute this line to the enclosing declaration or statement.
        : orderError instanceof Error
          // Contribute this line to the enclosing declaration or statement.
          ? orderError.message
          // Contribute this line to the enclosing declaration or statement.
          : 'Could not load checkout. Please try again.';
    // Return control to the caller with the following value.
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-[var(--color-danger)]" data-testid="checkout-load-error">
          {message}
        </p>
        <Link
          to="/"
          className="mt-4 inline-block font-medium text-[var(--color-accent-ink)] hover:underline"
        >
          Start a new search
        </Link>
      </div>
    );
  }

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0 overflow-x-clip">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Secure payment
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
            Checkout
          </h1>
          <p className="mt-3 max-w-xl text-white/80">
            Confirm add-ons and enter your contact details to pay securely with Stripe.
          </p>
        </div>
      </section>

      <div className="mx-auto min-w-0 max-w-4xl px-4 py-10 sm:px-6">
        <div className="grid min-w-0 gap-8 lg:grid-cols-2">
          <div className="min-w-0 space-y-6">
            <BookingAddOns
              extras={extras}
              hotelDelivery={hotelDelivery}
              onChange={updateAddOns}
              disabled={checkoutMutation.isPending}
            />

            <form
              className="min-w-0 space-y-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-soft)] sm:p-6 lg:p-8"
              onSubmit={(e) => {
                e.preventDefault();
                setError('');
                checkoutMutation.mutate();
              }}
            >
              <Input
                label="Full name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
              <Input
                label="Phone number"
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <Input
                label="Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
              <Input
                label="Hotel name (optional)"
                value={form.hotelName}
                onChange={(e) => setForm({ ...form, hotelName: e.target.value })}
              />

              {error && <ErrorAlert message={error} />}

              <Button type="submit" size="lg" loading={checkoutMutation.isPending} className="w-full">
                Pay with Stripe
              </Button>
            </form>
          </div>

          <div className="min-w-0">
            <OrderSummary order={orderData} />
          </div>
        </div>
      </div>
    </div>
  );
}
