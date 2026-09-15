import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCar } from '../../api/cars';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/Loading';
import { formatPrice, imageUrl } from '../../utils/format';
import { parseSearchFromUrl } from '../../utils/searchParams';

const PLACEHOLDER_IMAGE = '/placeholder-car.svg';

function SpecIcon({ kind }: { kind: 'gear' | 'fuel' | 'seats' | 'category' }) {
  const common = 'h-5 w-5 text-[var(--color-accent-ink)]';
  if (kind === 'gear') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'fuel') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 20V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14M7 20h8M10 9h2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M15 10h2.5a2 2 0 0 1 2 2v5a1.5 1.5 0 1 0 3 0V9.5L19 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'seats') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 11V8a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5 14h14v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 12 4.5 7.5M12 12l7.5-4.5M12 12v9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function formatTripDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function CarDetailPage() {
  const { carId } = useParams<{ carId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);

  const search = useMemo(() => parseSearchFromUrl(searchParams), [searchParams]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['car', carId],
    queryFn: () => getCar(carId!),
    enabled: !!carId,
  });

  useEffect(() => {
    setImgFailed(false);
  }, [data?.car.image]);

  const handleBook = () => {
    if (!search || !carId) return;
    const qs = searchParams.toString();
    navigate(`/order/${carId}${qs ? `?${qs}` : ''}`);
  };

  if (isLoading) return <PageLoader />;

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-[var(--color-danger)]">
          {(error as Error)?.message ?? 'Car not found'}
        </p>
        <Link
          to="/"
          className="mt-4 inline-block font-medium text-[var(--color-accent-ink)] hover:underline"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const car = data.car;
  const carImageSrc = imgFailed ? PLACEHOLDER_IMAGE : imageUrl(car.image);

  const specs = [
    { kind: 'gear' as const, label: 'Transmission', value: car.transmission },
    { kind: 'fuel' as const, label: 'Fuel', value: car.fuelType },
    { kind: 'seats' as const, label: 'Seats', value: String(car.seats) },
    { kind: 'category' as const, label: 'Category', value: car.category || 'Standard' },
  ];

  const tiers = [
    { label: '1–3 days', price: car.priceTier_1_3, hint: 'Short trips' },
    { label: '7–31 days', price: car.priceTier_7_31, hint: 'Best for holidays' },
    { label: '31+ days', price: car.priceTier_31_plus, hint: 'Long-term rate' },
  ].filter((tier) => tier.price != null);

  const fromPrice =
    car.priceTier_31_plus ?? car.priceTier_7_31 ?? car.priceTier_1_3 ?? car.pricePerDay ?? car.price;

  return (
    <div className="min-w-0 overflow-x-clip">
      <section className="border-b border-[var(--color-line)] bg-[var(--color-surface-elevated)]">
        <div className="mx-auto flex max-w-7xl min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <Link
            to={search ? `/search?${searchParams.toString()}` : '/'}
            className="text-sm font-medium text-[var(--color-accent-ink)] hover:underline"
          >
            ← Back to results
          </Link>
          {fromPrice != null && (
            <p className="text-sm text-[var(--color-muted)]">
              From{' '}
              <span className="font-display font-semibold text-[var(--color-ink)]">
                {formatPrice(fromPrice)}
              </span>
              /day
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto min-w-0 max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
          <div className="min-w-0 space-y-6">
            <div className="overflow-hidden rounded-2xl bg-[var(--color-ink-soft)] shadow-[var(--shadow-lift)]">
              <img
                key={car.image}
                src={carImageSrc}
                alt={car.name}
                className="aspect-[4/3] w-full object-cover"
                onError={() => setImgFailed(true)}
              />
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3 py-3 sm:px-4"
                >
                  <SpecIcon kind={spec.kind} />
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                      {spec.label}
                    </p>
                    <p className="break-words font-display text-sm font-semibold text-[var(--color-ink)]">
                      {spec.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 animate-lux-rise space-y-6 lg:sticky lg:top-24">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-ink)]">
                Vehicle details
              </p>
              <h1 className="mt-2 break-words font-display text-3xl font-extrabold tracking-tight text-[var(--color-navy)] sm:text-4xl">
                {car.name}
              </h1>
              <p className="mt-3 text-[var(--color-muted)] leading-relaxed">
                Well-maintained {car.category || 'fleet'} vehicle with transparent daily rates for
                your trip across Bulgaria.
              </p>
            </div>

            {search && (
              <div className="min-w-0 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-4 sm:px-5">
                <p className="font-display text-sm font-semibold text-[var(--color-ink)]">Your trip</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex min-w-0 justify-between gap-3">
                    <dt className="shrink-0 text-[var(--color-muted)]">Pickup</dt>
                    <dd className="min-w-0 text-right font-medium text-[var(--color-ink)]">
                      {formatTripDate(search.pickupDate)} · {search.pickupTime}
                      <span className="mt-0.5 block break-words text-xs font-normal text-[var(--color-muted)]">
                        {search.pickupLocation}
                      </span>
                    </dd>
                  </div>
                  <div className="flex min-w-0 justify-between gap-3">
                    <dt className="shrink-0 text-[var(--color-muted)]">Return</dt>
                    <dd className="min-w-0 text-right font-medium text-[var(--color-ink)]">
                      {formatTripDate(search.returnDate)} · {search.returnTime}
                      <span className="mt-0.5 block break-words text-xs font-normal text-[var(--color-muted)]">
                        {search.returnLocation}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="min-w-0 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
              <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
                Pricing tiers
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Daily rate decreases for longer rentals.
              </p>
              <div className="mt-4 space-y-2">
                {tiers.map((tier, index) => (
                  <div
                    key={tier.label}
                    className={`flex min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-3 sm:px-3.5 ${
                      index === 1
                        ? 'border border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)]/40'
                        : 'bg-[var(--color-surface)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--color-ink)]">{tier.label}</p>
                      <p className="text-xs text-[var(--color-muted)]">{tier.hint}</p>
                    </div>
                    <p className="shrink-0 font-display text-base font-semibold text-[var(--color-ink)]">
                      {formatPrice(tier.price!)}
                      <span className="text-sm font-normal text-[var(--color-muted)]">/day</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {search ? (
              <Button size="lg" className="w-full" onClick={handleBook}>
                Book this car
              </Button>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-5 text-center sm:px-5">
                <p className="text-sm text-[var(--color-muted)]">
                  Choose pickup and return dates to unlock live pricing and book this vehicle.
                </p>
                <Link to="/" className="mt-4 inline-block">
                  <Button size="lg">Search dates</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
