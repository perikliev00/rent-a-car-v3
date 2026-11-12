/**
 * Availability search results driven entirely by the URL query string.
 * Trip criteria and fleet filters stay shareable; invalid params prompt a home redirect.
 */
import { useMemo } from 'react';
// Import named exports from 'react-router-dom'.
import { useSearchParams, Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from '../../api/cars'.
import { searchCars } from '../../api/cars';
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
  // Contribute this line to the enclosing declaration or statement.
  fleetFiltersFromUrl,
  // Declare the FleetFilterValue TypeScript type alias.
  type FleetFilterValue,
// Contribute this line to the enclosing declaration or statement.
} from '../../components/cars/CarFleetFilters';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../utils/searchParams'.
import { parseSearchFromUrl, searchParamsToQuery } from '../../utils/searchParams';
// Import named exports from '../../utils/searchParams'.
import { defaultSearchParams } from '../../utils/searchParams';
// Contribute this line to the enclosing declaration or statement.
import type { SearchParams } from '../../types/api';

/**
 * Priced car search results for the current trip criteria and filters.
 *
 * @returns Search results UI, or an invalid-params fallback when the URL is incomplete.
 * @remarks Side effects: updates the URL via `setUrlParams`; fetches priced cars when params are valid.
 */
export function SearchResultsPage() {
  // Destructure array values into local variables.
  const [urlParams, setUrlParams] = useSearchParams();

  // Prefer URL trip criteria; fall back to defaults only for form display.
  const search = useMemo(
    // Continue the surrounding logic with this statement.
    () => parseSearchFromUrl(urlParams) ?? defaultSearchParams(),
    // Contribute this line to the enclosing declaration or statement.
    [urlParams],
  );

  // Create the page constant.
  const page = Number(urlParams.get('page') ?? 1);
  // Create the filters constant.
  const filters = useMemo(() => fleetFiltersFromUrl(urlParams), [urlParams]);

  // Destructure object properties into local variables.
  const { data: categoriesData } = useQuery({
    // Provide the query key field value.
    queryKey: ['categories'],
    // Provide the query fn field value.
    queryFn: getCategories,
  });

  // Only hit the search API when the URL has a complete trip window.
  const { data, isLoading, isError, error, refetch } = useQuery({
    // Provide the query key field value.
    queryKey: ['cars', 'search', search, page, filters],
    // Provide the query fn field value.
    queryFn: () => searchCars(search, { ...filters, page }),
    // Provide the enabled field value.
    enabled: !!parseSearchFromUrl(urlParams),
  });

  /** Patch individual URL keys (null deletes). */
  const updateUrlParams = (updates: Record<string, string | null>) => {
    // Create the params constant.
    const params = new URLSearchParams(urlParams);
    // Call Object.entries to perform this step.
    Object.entries(updates).forEach(([key, value]) => {
      // Evaluate the condition and enter the branch when it is true.
      if (value === null) {
        // Call params.delete to perform this step.
        params.delete(key);
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Call params.set to perform this step.
        params.set(key, value);
      }
    });
    // Call setUrlParams to perform this step.
    setUrlParams(params);
  };

  /** Replace trip criteria in the URL while preserving current filters. */
  const handleSearch = (newSearch: SearchParams) => {
    // Create the params constant.
    const params = new URLSearchParams(searchParamsToQuery(newSearch));
    // Call applyFleetFiltersToParams to perform this step.
    applyFleetFiltersToParams(params, filters);
    // Call setUrlParams to perform this step.
    setUrlParams(params);
  };

  /** Re-apply the controlled form values to the URL (submit button). */
  const handleSubmit = () => {
    // Create the params constant.
    const params = new URLSearchParams(searchParamsToQuery(search));
    // Call applyFleetFiltersToParams to perform this step.
    applyFleetFiltersToParams(params, filters);
    // Call setUrlParams to perform this step.
    setUrlParams(params);
  };

  /** Write fleet filters to the URL and reset to page 1. */
  const handleFiltersChange = (next: FleetFilterValue) => {
    // Create the params constant.
    const params = new URLSearchParams(urlParams);
    // Call applyFleetFiltersToParams to perform this step.
    applyFleetFiltersToParams(params, next);
    // Call params.set to perform this step.
    params.set('page', '1');
    // Call setUrlParams to perform this step.
    setUrlParams(params);
  };

  // Incomplete deep-links should not invent a search — send the user home.
  if (!parseSearchFromUrl(urlParams)) {
    // Return control to the caller with the following value.
    return (
      <div>
        <section className="bg-navy text-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
              Available cars
            </h1>
            <p className="mt-3 text-white/80">Invalid search parameters.</p>
          </div>
        </section>
        <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
          <Link to="/">
            <Button size="lg">Go back home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0 overflow-x-clip">
      <section className="relative overflow-x-clip bg-navy text-white">
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="animate-lux-rise">
            <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-[var(--color-accent)]">
              Search results
            </p>
            <h1 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
              Available cars
            </h1>
            {data ? (
              <p className="mt-3 text-white/80">
                {data.cars.length} car{data.cars.length !== 1 ? 's' : ''} found for{' '}
                {data.rentalDays} day{data.rentalDays !== 1 ? 's' : ''}
              </p>
            ) : (
              <p className="mt-3 text-white/80">
                Refine your dates and locations to find the right vehicle.
              </p>
            )}
          </div>

          <div className="relative z-20 mt-8 min-w-0 animate-lux-rise-delay bg-[var(--color-navy-deep)] px-3 py-5 shadow-[var(--shadow-lift)] sm:px-6">
            <SearchForm
              values={search}
              onChange={handleSearch}
              onSubmit={handleSubmit}
              compact
              tone="onDark"
              submitLabel="Update search"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto min-w-0 max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 min-w-0">
        <CarFleetFilters
          categories={categoriesData?.categories ?? []}
          value={filters}
          onChange={handleFiltersChange}
        />
      </div>

      {isLoading && <PageLoader />}

      {isError && (
        <div className="rounded-xl border border-[var(--color-danger)]/30 bg-red-50 p-4 text-[var(--color-danger)]">
          {(error as Error).message}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <>
          {data.cars.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center">
              <p className="font-display text-lg font-semibold text-[var(--color-ink)]">
                No cars available
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Try different dates or locations.
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.cars.map((car) => {
                // Carry trip + filters into the detail deep-link.
                const qs = searchParamsToQuery(search);
                const detailParams = new URLSearchParams(qs);
                applyFleetFiltersToParams(detailParams, filters);
                const detailUrl = `/cars/${car.id}?${detailParams.toString()}`;
                return <CarCard key={car.id} car={car} detailUrl={detailUrl} />;
              })}
            </div>
          )}

          {data.pagination.totalPages > 1 && (
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateUrlParams({ page: String(page - 1) })}
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
                onClick={() => updateUrlParams({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
