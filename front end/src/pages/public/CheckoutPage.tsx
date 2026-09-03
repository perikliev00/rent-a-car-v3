import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { startCheckout } from '../../api/checkout';
import { BookingAddOns } from '../../components/booking/BookingAddOns';
import { OrderSummary } from '../../components/booking/OrderSummary';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ErrorAlert } from '../../components/ui/Toast';
import { ApiError } from '../../api/client';
import { parseSearchFromUrl, searchParamsToQuery } from '../../utils/searchParams';
import { createOrder } from '../../api/orders';
import { PageLoader } from '../../components/ui/Loading';

export function CheckoutPage() {
  const { carId } = useParams<{ carId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = useMemo(() => parseSearchFromUrl(searchParams), [searchParams]);

  const extras = search?.extras || [];
  const hotelDelivery = Boolean(search?.hotelDelivery);

  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    address: '',
    hotelName: '',
  });
  const [error, setError] = useState('');

  const { data: orderData, isLoading, isError, error: orderError } = useQuery({
    queryKey: ['order-preview', carId, search, extras, hotelDelivery],
    queryFn: () =>
      createOrder({
        carId: Number(carId),
        pickupDate: search!.pickupDate,
        returnDate: search!.returnDate,
        pickupLocation: search!.pickupLocation,
        returnLocation: search!.returnLocation,
        pickupTime: search!.pickupTime,
        returnTime: search!.returnTime,
        extras,
        hotelDelivery,
      }),
    enabled: !!search && !!carId,
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      startCheckout({
        carId: Number(carId),
        pickupDate: search!.pickupDate,
        returnDate: search!.returnDate,
        pickupLocation: search!.pickupLocation,
        returnLocation: search!.returnLocation,
        pickupTime: search!.pickupTime,
        returnTime: search!.returnTime,
        extras,
        hotelDelivery: hotelDelivery || Boolean(form.hotelName),
        ...form,
      }),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Checkout failed. Please try again.');
      }
    },
  });

  const updateAddOns = (next: { extras: string[]; hotelDelivery: boolean }) => {
    if (!search) return;
    setSearchParams(
      searchParamsToQuery({
        ...search,
        extras: next.extras,
        hotelDelivery: next.hotelDelivery,
      }),
      { replace: true }
    );
  };

  if (!search || !carId) {
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

  if (isError || !orderData) {
    const message =
      orderError instanceof ApiError
        ? orderError.message
        : orderError instanceof Error
          ? orderError.message
          : 'Could not load checkout. Please try again.';
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

  return (
    <div>
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

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <BookingAddOns
              extras={extras}
              hotelDelivery={hotelDelivery}
              onChange={updateAddOns}
              disabled={checkoutMutation.isPending}
            />

            <form
              className="space-y-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-soft)] sm:p-8"
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

          <OrderSummary order={orderData} />
        </div>
      </div>
    </div>
  );
}
