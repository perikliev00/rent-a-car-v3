import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchCars } from '../../api/cars';
import { getCategories } from '../../api/locations';
import { SearchForm } from '../../components/booking/SearchForm';
import { CarCard } from '../../components/cars/CarCard';
import {
  applyFleetFiltersToParams,
  CarFleetFilters,
  fleetFiltersFromUrl,
  type FleetFilterValue,
} from '../../components/cars/CarFleetFilters';
import { PageLoader } from '../../components/ui/Loading';
import { Button } from '../../components/ui/Button';
import { parseSearchFromUrl, searchParamsToQuery } from '../../utils/searchParams';
import { defaultSearchParams } from '../../utils/searchParams';
import type { SearchParams } from '../../types/api';

export function SearchResultsPage() {
  const [urlParams, setUrlParams] = useSearchParams();

  const search = useMemo(
    () => parseSearchFromUrl(urlParams) ?? defaultSearchParams(),
    [urlParams],
  );

  const page = Number(urlParams.get('page') ?? 1);
  const filters = useMemo(() => fleetFiltersFromUrl(urlParams), [urlParams]);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cars', 'search', search, page, filters],
    queryFn: () => searchCars(search, { ...filters, page }),
    enabled: !!parseSearchFromUrl(urlParams),
  });

  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(urlParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    setUrlParams(params);
  };

  const handleSearch = (newSearch: SearchParams) => {
    const params = new URLSearchParams(searchParamsToQuery(newSearch));
    applyFleetFiltersToParams(params, filters);
    setUrlParams(params);
  };

  const handleSubmit = () => {
    const params = new URLSearchParams(searchParamsToQuery(search));
    applyFleetFiltersToParams(params, filters);
    setUrlParams(params);
  };

  const handleFiltersChange = (next: FleetFilterValue) => {
    const params = new URLSearchParams(urlParams);
    applyFleetFiltersToParams(params, next);
    params.set('page', '1');
    setUrlParams(params);
  };

  if (!parseSearchFromUrl(urlParams)) {
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
