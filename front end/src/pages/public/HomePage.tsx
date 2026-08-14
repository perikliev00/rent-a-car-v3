import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCars } from '../../api/cars';
import { getCategories } from '../../api/locations';
import { SearchForm } from '../../components/booking/SearchForm';
import { CarCard } from '../../components/cars/CarCard';
import {
  applyFleetFiltersToParams,
  CarFleetFilters,
  type FleetFilterValue,
} from '../../components/cars/CarFleetFilters';
import { AdvantageSplit } from '../../components/marketing/AdvantageSplit';
import { DealsSection } from '../../components/marketing/DealsSection';
import { ReviewsCarousel } from '../../components/marketing/ReviewsCarousel';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Loading';
import {
  heroImage,
  heroImageAlt,
  partnerMarks,
  stockCarImages,
} from '../../data/marketingAssets';
import { imageUrl } from '../../utils/format';
import { defaultSearchParams, searchParamsToQuery } from '../../utils/searchParams';
import type { SearchParams } from '../../types/api';

export function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState<SearchParams>(defaultSearchParams());
  const [filters, setFilters] = useState<FleetFilterValue>({});
  const [page, setPage] = useState(1);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['cars', 'home', filters, page],
    queryFn: () => getCars({ ...filters, page }),
  });

  const handleFiltersChange = (next: FleetFilterValue) => {
    setFilters(next);
    setPage(1);
  };

  const handleSearch = () => {
    const params = new URLSearchParams(searchParamsToQuery(search));
    applyFleetFiltersToParams(params, filters);
    navigate(`/search?${params.toString()}`);
  };

  const showcaseCars = [
    imageUrl(data?.cars[0]?.image) !== '/placeholder-car.svg'
      ? imageUrl(data?.cars[0]?.image)
      : stockCarImages[0],
    imageUrl(data?.cars[1]?.image) !== '/placeholder-car.svg'
      ? imageUrl(data?.cars[1]?.image)
      : stockCarImages[1],
  ];

  return (
    <div>
      <section className="relative overflow-visible text-white">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt={heroImageAlt}
            className="h-full w-full object-cover"
            fetchPriority="high"
          />
          <div className="hero-photo-overlay absolute inset-0" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-28 pt-16 sm:px-6 sm:pb-32 sm:pt-20 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center animate-lux-rise">
            <p className="font-display text-sm font-bold uppercase tracking-[0.28em] text-[var(--color-accent)]">
              LuxRide
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold uppercase leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Drive Bulgaria in style
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              Premium car rental with transparent pricing, flexible pickup locations, and instant
              online booking.
            </p>
          </div>

          <div className="relative z-20 animate-lux-rise-delay mx-auto mt-10 max-w-5xl bg-[var(--color-navy)] px-4 py-6 shadow-[var(--shadow-lift)] sm:px-7 sm:py-8">
            <p className="mb-5 font-display text-sm font-bold uppercase tracking-[0.14em] text-white sm:text-base">
              Search and compare car rental rates
            </p>
            <SearchForm
              values={search}
              onChange={setSearch}
              onSubmit={handleSearch}
              tone="onDark"
              submitLabel="Get your quote"
            />
          </div>
        </div>
      </section>

      <section className="relative z-10 border-b border-[var(--color-line)] bg-[var(--color-surface-elevated)]">
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 md:justify-start">
            {partnerMarks.map((mark) => (
              <span
                key={mark}
                className="font-display text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-navy)]/55"
              >
                {mark}
              </span>
            ))}
          </div>

          <div className="pointer-events-none absolute -top-16 right-4 hidden h-40 w-[min(42%,22rem)] md:block lg:right-8">
            <img
              src={showcaseCars[0]}
              alt=""
              className="absolute bottom-0 right-16 h-36 w-auto max-w-[55%] object-contain drop-shadow-xl"
              onError={(e) => {
                e.currentTarget.src = stockCarImages[0];
              }}
            />
            <img
              src={showcaseCars[1]}
              alt=""
              className="absolute bottom-0 right-0 h-40 w-auto max-w-[58%] object-contain drop-shadow-xl"
              onError={(e) => {
                e.currentTarget.src = stockCarImages[1];
              }}
            />
          </div>
        </div>
      </section>

      <ReviewsCarousel />
      <AdvantageSplit />
      <DealsSection />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-10 space-y-6">
          <div>
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-tight text-[var(--color-navy)]">
              Our fleet
            </h2>
            <p className="mt-2 text-[var(--color-muted)]">
              Browse our selection of well-maintained vehicles
            </p>
          </div>
          <CarFleetFilters
            categories={categoriesData?.categories ?? []}
            value={filters}
            onChange={handleFiltersChange}
          />
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data?.cars.map((car) => (
              <CarCard key={car.id} car={car} showPricing detailUrl={`/cars/${car.id}`} />
            ))}
          </div>
        )}

        {!isLoading && data?.cars.length === 0 && (
          <p className="text-center text-[var(--color-muted)]">No cars available at the moment.</p>
        )}

        {!isLoading && data && data.pagination.totalPages > 1 && (
          <div className="mt-10 flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="flex items-center px-3 text-sm text-[var(--color-muted)]">
              Page {data.pagination.currentPage} of {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </section>

      <section className="border-t border-[var(--color-line)] bg-[var(--color-surface-elevated)] py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-3">
          {[
            {
              title: 'Transparent pricing',
              desc: 'No hidden fees. See the full price before you book.',
            },
            {
              title: 'Flexible locations',
              desc: 'Pickup and return at office, airports, or resort towns.',
            },
            {
              title: 'Secure payment',
              desc: 'Pay safely online via Stripe. Instant confirmation.',
            },
          ].map((item) => (
            <div key={item.title} className="text-center md:text-left">
              <h3 className="font-display text-lg font-bold uppercase tracking-tight text-[var(--color-navy)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
