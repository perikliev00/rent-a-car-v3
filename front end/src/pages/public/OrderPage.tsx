/**
 * Pre-checkout hold step: creates a soft reservation for the selected car
 * using trip criteria from the URL. When dates/locations/addons change, the
 * hold is recreated. CONFLICT responses offer release or release-and-rehold
 * so the customer can recover from an existing active hold.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
// Import named exports from 'react-router-dom'.
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useMutation } from '@tanstack/react-query';
// Import named exports from '../../api/orders'.
import { createOrder } from '../../api/orders';
// Import named exports from '../../api/reservations'.
import { releaseReservation, releaseAndRehold } from '../../api/reservations';
// Import named exports from '../../components/booking/BookingAddOns'.
import { BookingAddOns } from '../../components/booking/BookingAddOns';
// Import named exports from '../../components/booking/OrderSummary'.
import { OrderSummary } from '../../components/booking/OrderSummary';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Toast'.
import { ErrorAlert } from '../../components/ui/Toast';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../api/client'.
import { ApiError } from '../../api/client';
// Import named exports from '../../utils/searchParams'.
import { bookingQueryString, parseSearchFromUrl, searchParamsToQuery } from '../../utils/searchParams';
// Contribute this line to the enclosing declaration or statement.
import type { OrderPageData } from '../../types/api';

/**
 * Order review page that places/refreshes the car hold before checkout.
 *
 * @returns Hold review UI, conflict recovery actions, or missing-params fallback.
 * @remarks Side effects: creates/refreshes soft holds via {@link createOrder}; may release/rehold on conflict.
 */
export function OrderPage() {
  // Destructure object properties into local variables.
  const { carId } = useParams<{ carId: string }>();
  // Destructure array values into local variables.
  const [searchParams, setSearchParams] = useSearchParams();
  // Create the navigate constant.
  const navigate = useNavigate();
  // Destructure array values into local variables.
  const [orderData, setOrderData] = useState<OrderPageData | null>(null);
  // Destructure array values into local variables.
  const [conflictError, setConflictError] = useState<string | null>(null);
  /** Survives re-renders so CONFLICT handling can ignore errors after a successful hold. */
  const orderDataRef = useRef<OrderPageData | null>(null);
  /** Tracks trip+car identity so we reset local state when criteria change. */
  const holdKeyRef = useRef<string>('');

  // Create the search constant.
  const search = useMemo(() => parseSearchFromUrl(searchParams), [searchParams]);
  // Create the extras constant.
  const extras = search?.extras || [];
  // Create the hotel delivery constant.
  const hotelDelivery = Boolean(search?.hotelDelivery);

  // Create the order mutation constant.
  const orderMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
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
    // Provide the on success field value.
    onSuccess: (data) => {
      // Update orderDataRef.current with the right-hand side value.
      orderDataRef.current = data;
      // Call setOrderData to perform this step.
      setOrderData(data);
      // Call setConflictError to perform this step.
      setConflictError(null);
    },
    // Provide the on error field value.
    onError: (err) => {
      // Ignore conflicts once we already have a successful hold payload.
      if (orderDataRef.current) return;
      // Evaluate the condition and enter the branch when it is true.
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        // Call setConflictError to perform this step.
        setConflictError(err.message);
      }
    },
  });

  // Create the release mutation constant.
  const releaseMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: releaseReservation,
    // After releasing the old hold, immediately retry creating this order.
    onSuccess: () => orderMutation.mutate(),
  });

  // Create the rehold mutation constant.
  const reholdMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
      // Call releaseAndRehold to perform this step.
      releaseAndRehold({
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
    // Provide the on success field value.
    onSuccess: () => orderMutation.mutate(),
  });

  // Identity string for the current trip window + add-ons (excludes car until combined below).
  const searchKey = search
    // Continue the surrounding logic with this statement.
    ? `${search.pickupDate}|${search.returnDate}|${search.pickupLocation}|${search.returnLocation}|${extras.join(',')}|${hotelDelivery}`
    // Contribute this line to the enclosing declaration or statement.
    : '';

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!search || !carId) return;
    // Create the hold key constant.
    const holdKey = `${searchKey}|${carId}`;
    // Criteria changed — drop stale order state before requesting a new hold.
    if (holdKeyRef.current !== holdKey) {
      // Update holdKeyRef.current with the right-hand side value.
      holdKeyRef.current = holdKey;
      // Update orderDataRef.current with the right-hand side value.
      orderDataRef.current = null;
      // Call setOrderData to perform this step.
      setOrderData(null);
      // Call setConflictError to perform this step.
      setConflictError(null);
    }
    // Call orderMutation.mutate to perform this step.
    orderMutation.mutate();
    // Recreate hold/pricing when dates/locations/addons change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, carId]);

  /** Persist add-on choices into the URL (replace) so refresh keeps them. */
  const updateAddOns = (next: { extras: string[]; hotelDelivery: boolean }) => {
    // Evaluate the condition and enter the branch when it is true.
    if (!search) return;
    // Create the merged constant.
    const merged = { ...search, extras: next.extras, hotelDelivery: next.hotelDelivery };
    // Call setSearchParams to perform this step.
    setSearchParams(searchParamsToQuery(merged), { replace: true });
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

  // First load — show a full-page spinner until we have order data.
  if (orderMutation.isPending && !orderData) return <PageLoader />;

  // Evaluate the condition and enter the branch when it is true.
  if (conflictError) {
    // Return control to the caller with the following value.
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <ErrorAlert message={conflictError}>
          <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              size="sm"
              className="w-full sm:w-auto"
              loading={releaseMutation.isPending}
              onClick={() => releaseMutation.mutate()}
            >
              Release existing reservation
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              loading={reholdMutation.isPending}
              onClick={() => reholdMutation.mutate()}
            >
              Release & rehold this car
            </Button>
            <Link to={`/search?${bookingQueryString(search)}`} className="w-full sm:w-auto">
              <Button variant="ghost" size="sm" className="w-full sm:w-auto">
                Choose another car
              </Button>
            </Link>
          </div>
        </ErrorAlert>
      </div>
    );
  }

  // Evaluate the condition and enter the branch when it is true.
  if (orderMutation.isError && !conflictError && !orderData) {
    // Return control to the caller with the following value.
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <ErrorAlert message={(orderMutation.error as Error).message}>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => orderMutation.mutate()}>
            Retry
          </Button>
        </ErrorAlert>
      </div>
    );
  }

  if (!orderData) return <PageLoader />;

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0 overflow-x-clip">
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Booking
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
            Review your booking
          </h1>
          <p className="mt-3 max-w-xl text-white/80">
            Choose add-ons if you need them. Your car is held temporarily — complete checkout to
            confirm.
          </p>
        </div>
      </section>

      <div className="mx-auto min-w-0 max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <BookingAddOns
          extras={extras}
          hotelDelivery={hotelDelivery}
          onChange={updateAddOns}
          disabled={orderMutation.isPending}
        />

        <OrderSummary order={orderData} />

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => navigate(`/checkout/${carId}?${bookingQueryString(search)}`)}
          >
            Continue to checkout
          </Button>
          <Link to={`/cars/${carId}?${bookingQueryString(search)}`} className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Back
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
