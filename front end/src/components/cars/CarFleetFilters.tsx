import type { Category } from '../../api/locations';
import type { CarListFilters } from '../../api/cars';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

export type FleetFilterValue = Omit<CarListFilters, 'page'>;

interface CarFleetFiltersProps {
  categories: Category[];
  value: FleetFilterValue;
  onChange: (next: FleetFilterValue) => void;
}

const TRANSMISSION_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'Automatic', label: 'Automatic' },
  { value: 'Manual', label: 'Manual' },
];

const FUEL_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'Petrol', label: 'Petrol' },
  { value: 'Diesel', label: 'Diesel' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Electric', label: 'Electric' },
];

function pillClass(active: boolean): string {
  return `rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
    active
      ? 'bg-[var(--color-ink)] text-white'
      : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]'
  }`;
}

function hasActiveAdvancedFilters(value: FleetFilterValue): boolean {
  return Boolean(
    value.transmission ||
      value.fuelType ||
      value.seatsMin ||
      value.seatsMax ||
      value.priceMin ||
      value.priceMax,
  );
}

export function CarFleetFilters({ categories, value, onChange }: CarFleetFiltersProps) {
  const patch = (partial: Partial<FleetFilterValue>) => {
    onChange({ ...value, ...partial });
  };

  const clearAdvanced = () => {
    onChange({
      categoryId: value.categoryId,
      transmission: undefined,
      fuelType: undefined,
      seatsMin: undefined,
      seatsMax: undefined,
      priceMin: undefined,
      priceMax: undefined,
    });
  };

  return (
    <div className="space-y-4">
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => patch({ categoryId: undefined })}
            className={pillClass(value.categoryId === undefined)}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => patch({ categoryId: category.id })}
              className={pillClass(value.categoryId === category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Select
          label="Transmission"
          value={value.transmission ?? ''}
          options={TRANSMISSION_OPTIONS}
          onChange={(e) => patch({ transmission: e.target.value || undefined })}
        />
        <Select
          label="Fuel"
          value={value.fuelType ?? ''}
          options={FUEL_OPTIONS}
          onChange={(e) => patch({ fuelType: e.target.value || undefined })}
        />
        <Input
          label="Seats min"
          type="number"
          min={2}
          max={9}
          value={value.seatsMin ?? ''}
          placeholder="2"
          onChange={(e) => patch({ seatsMin: e.target.value || undefined })}
        />
        <Input
          label="Seats max"
          type="number"
          min={2}
          max={9}
          value={value.seatsMax ?? ''}
          placeholder="9"
          onChange={(e) => patch({ seatsMax: e.target.value || undefined })}
        />
        <Input
          label="Price min"
          type="number"
          min={0}
          step="1"
          value={value.priceMin ?? ''}
          placeholder="0"
          onChange={(e) => patch({ priceMin: e.target.value || undefined })}
        />
        <Input
          label="Price max"
          type="number"
          min={0}
          step="1"
          value={value.priceMax ?? ''}
          placeholder="Any"
          onChange={(e) => patch({ priceMax: e.target.value || undefined })}
        />
      </div>

      {hasActiveAdvancedFilters(value) ? (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={clearAdvanced}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Serialize fleet filters into URLSearchParams keys (skips empty). */
export function applyFleetFiltersToParams(
  params: URLSearchParams,
  filters: FleetFilterValue,
): void {
  const entries: Array<[string, string | number | undefined]> = [
    ['categoryId', filters.categoryId],
    ['transmission', filters.transmission],
    ['fuelType', filters.fuelType],
    ['seatsMin', filters.seatsMin],
    ['seatsMax', filters.seatsMax],
    ['priceMin', filters.priceMin],
    ['priceMax', filters.priceMax],
  ];

  for (const [key, raw] of entries) {
    if (raw === undefined || raw === '') {
      params.delete(key);
    } else {
      params.set(key, String(raw));
    }
  }
}

export function fleetFiltersFromUrl(params: URLSearchParams): FleetFilterValue {
  const categoryRaw = params.get('categoryId');
  const categoryId = categoryRaw ? Number(categoryRaw) : NaN;

  return {
    categoryId: Number.isFinite(categoryId) && categoryId > 0 ? categoryId : undefined,
    transmission: params.get('transmission') || undefined,
    fuelType: params.get('fuelType') || undefined,
    seatsMin: params.get('seatsMin') || undefined,
    seatsMax: params.get('seatsMax') || undefined,
    priceMin: params.get('priceMin') || undefined,
    priceMax: params.get('priceMax') || undefined,
  };
}
