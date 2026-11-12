/**
 * Marketing landing page: hero search form, fleet preview, and content sections.
 * Submitting search navigates to `/search` with trip criteria in the query string.
 */
import { useState } from 'react';
// Import named exports from 'react-router-dom'.
import { useNavigate } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from '../../api/cars'.
import { getCars } from '../../api/cars';
// Import named exports from '../../api/locations'.
import { getCategories } from '../../api/locations';
// Import named exports from '../../components/booking/SearchForm'.
import { SearchForm } from '../../components/booking/SearchForm';
// Import named exports from '../../components/cars/CarCard'.
import { CarCard } from '../../components/cars/CarCard';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  applyFleetFiltersToParams,
  // Contribute this line to the enclosing declaration or statement.
  CarFleetFilters,
  // Declare the FleetFilterValue TypeScript type alias.
  type FleetFilterValue,
// Contribute this line to the enclosing declaration or statement.
} from '../../components/cars/CarFleetFilters';
// Import named exports from '../../components/marketing/AdvantageSplit'.
import { AdvantageSplit } from '../../components/marketing/AdvantageSplit';
// Import named exports from '../../components/marketing/DealsSection'.
import { DealsSection } from '../../components/marketing/DealsSection';
// Import named exports from '../../components/marketing/ReviewsCarousel'.
import { ReviewsCarousel } from '../../components/marketing/ReviewsCarousel';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Loading'.
import { Skeleton } from '../../components/ui/Loading';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  heroImage,
  // Contribute this line to the enclosing declaration or statement.
  heroImageAlt,
  // Contribute this line to the enclosing declaration or statement.
  partnerMarks,
// Contribute this line to the enclosing declaration or statement.
} from '../../data/marketingAssets';
// Import named exports from '../../utils/searchParams'.
import { defaultSearchParams, searchParamsToQuery } from '../../utils/searchParams';
// Contribute this line to the enclosing declaration or statement.
import type { SearchParams } from '../../types/api';

/**
 * Public home page with search entry and featured fleet.
 *
 * @returns Marketing landing: hero search, partner strip, content sections, and paginated fleet.
 * @remarks Side effect: `handleSearch` navigates to `/search` with trip + filter query params.
 */
export function HomePage() {
  // Create the navigate constant.
  const navigate = useNavigate();
  // Destructure array values into local variables.
  const [search, setSearch] = useState<SearchParams>(defaultSearchParams());
  // Destructure array values into local variables.
  const [filters, setFilters] = useState<FleetFilterValue>({});
  // Destructure array values into local variables.
  const [page, setPage] = useState(1);

  // Destructure object properties into local variables.
  const { data: categoriesData } = useQuery({
    // Provide the query key field value.
    queryKey: ['categories'],
    // Provide the query fn field value.
    queryFn: getCategories,
  });

  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['cars', 'home', filters, page],
    // Provide the query fn field value.
    queryFn: () => getCars({ ...filters, page }),
  });

  /** Apply fleet filters and reset pagination to page 1. */
  const handleFiltersChange = (next: FleetFilterValue) => {
    // Call setFilters to perform this step.
    setFilters(next);
    // Call setPage to perform this step.
    setPage(1);
  };

  /** Navigate to search results with the current trip criteria and filters. */
  const handleSearch = () => {
    // Create the params constant.
    const params = new URLSearchParams(searchParamsToQuery(search));
    // Call applyFleetFiltersToParams to perform this step.
    applyFleetFiltersToParams(params, filters);
    // Call navigate to perform this step.
    navigate(`/search?${params.toString()}`);
  };

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0 overflow-x-clip">
      <section className="relative overflow-x-clip text-white">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt={heroImageAlt}
            className="h-full w-full object-cover"
            fetchPriority="high"
          />
          <div className="hero-photo-overlay absolute inset-0" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-20 lg:pt-24">
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

          <div className="relative z-20 mx-auto mt-10 min-w-0 max-w-5xl animate-lux-rise-delay bg-[var(--color-navy)] px-3 py-5 shadow-[var(--shadow-lift)] sm:px-7 sm:py-8">
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

      <section className="relative z-10 min-w-0 overflow-x-clip border-b border-[var(--color-line)] bg-[var(--color-surface-elevated)]">
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
        </div>
      </section>

      <ReviewsCarousel />
      <AdvantageSplit />
      <DealsSection />

      <section className="mx-auto min-w-0 max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-10 min-w-0 space-y-6">
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
          <div className="grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : (
          <div className="grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data?.cars.map((car) => (
              <CarCard key={car.id} car={car} showPricing detailUrl={`/cars/${car.id}`} />
            ))}
          </div>
        )}

        {!isLoading && data?.cars.length === 0 && (
          <p className="text-center text-[var(--color-muted)]">No cars available at the moment.</p>
        )}

        {!isLoading && data && data.pagination.totalPages > 1 && (
          <div className="mt-10 flex flex-wrap justify-center gap-2">
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
