import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createOrder } from '../../api/orders';
import { releaseReservation, releaseAndRehold } from '../../api/reservations';
import { BookingAddOns } from '../../components/booking/BookingAddOns';
import { OrderSummary } from '../../components/booking/OrderSummary';
import { Button } from '../../components/ui/Button';
import { ErrorAlert } from '../../components/ui/Toast';
import { PageLoader } from '../../components/ui/Loading';
import { ApiError } from '../../api/client';
import { bookingQueryString, parseSearchFromUrl, searchParamsToQuery } from '../../utils/searchParams';
import type { OrderPageData } from '../../types/api';

export function OrderPage() {
  const { carId } = useParams<{ carId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState<OrderPageData | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const orderDataRef = useRef<OrderPageData | null>(null);
  const holdKeyRef = useRef<string>('');

  const search = useMemo(() => parseSearchFromUrl(searchParams), [searchParams]);
  const extras = search?.extras || [];
  const hotelDelivery = Boolean(search?.hotelDelivery);

  const orderMutation = useMutation({
    mutationFn: () =>
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
    onSuccess: (data) => {
      orderDataRef.current = data;
      setOrderData(data);
      setConflictError(null);
    },
    onError: (err) => {
      if (orderDataRef.current) return;
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setConflictError(err.message);
      }
    },
  });

  const releaseMutation = useMutation({
    mutationFn: releaseReservation,
    onSuccess: () => orderMutation.mutate(),
  });

  const reholdMutation = useMutation({
    mutationFn: () =>
      releaseAndRehold({
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
    onSuccess: () => orderMutation.mutate(),
  });

  const searchKey = search
    ? `${search.pickupDate}|${search.returnDate}|${search.pickupLocation}|${search.returnLocation}|${extras.join(',')}|${hotelDelivery}`
    : '';

  useEffect(() => {
    if (!search || !carId) return;
    const holdKey = `${searchKey}|${carId}`;
    if (holdKeyRef.current !== holdKey) {
      holdKeyRef.current = holdKey;
      orderDataRef.current = null;
      setOrderData(null);
      setConflictError(null);
    }
    orderMutation.mutate();
    // Recreate hold/pricing when dates/locations/addons change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, carId]);

  const updateAddOns = (next: { extras: string[]; hotelDelivery: boolean }) => {
    if (!search) return;
    const merged = { ...search, extras: next.extras, hotelDelivery: next.hotelDelivery };
    setSearchParams(searchParamsToQuery(merged), { replace: true });
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

  if (orderMutation.isPending && !orderData) return <PageLoader />;

  if (conflictError) {
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

  if (orderMutation.isError && !conflictError && !orderData) {
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
