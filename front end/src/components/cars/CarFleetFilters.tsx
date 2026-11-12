/**
 * Category and advanced facet controls for fleet/search listings.
 * Helpers sync filter state to/from the URL so results remain shareable.
 */
import type { Category } from '../../api/locations';
// Contribute this line to the enclosing declaration or statement.
import type { CarListFilters } from '../../api/cars';
// Import named exports from '../ui/Button'.
import { Button } from '../ui/Button';
// Import named exports from '../ui/Input'.
import { Input } from '../ui/Input';
// Import named exports from '../ui/Select'.
import { Select } from '../ui/Select';

/** Fleet filters excluding pagination (page is managed separately). */
export type FleetFilterValue = Omit<CarListFilters, 'page'>;

// Declare the CarFleetFiltersProps TypeScript interface.
interface CarFleetFiltersProps {
  // Provide the categories field value.
  categories: Category[];
  // Provide the value field value.
  value: FleetFilterValue;
  // Provide the on change field value.
  onChange: (next: FleetFilterValue) => void;
}

// Create the transmission options constant.
const TRANSMISSION_OPTIONS = [
  // Contribute this line to the enclosing declaration or statement.
  { value: '', label: 'Any' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'Automatic', label: 'Automatic' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'Manual', label: 'Manual' },
];

// Create the fuel options constant.
const FUEL_OPTIONS = [
  // Contribute this line to the enclosing declaration or statement.
  { value: '', label: 'Any' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'Petrol', label: 'Petrol' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'Diesel', label: 'Diesel' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'Hybrid', label: 'Hybrid' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'Electric', label: 'Electric' },
];

/**
 * Build category-pill class names for active vs idle state.
 *
 * @param active - Whether this pill represents the current selection.
 * @returns Tailwind class string for the pill button.
 */
function pillClass(active: boolean): string {
  // Return the resulting value to the caller.
  return `rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
    // Reference the identifier used by the enclosing expression.
    active
      // Continue the surrounding logic with this statement.
      ? 'bg-[var(--color-ink)] text-white'
      // Continue the surrounding logic with this statement.
      : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]'
  // Continue the surrounding logic with this statement.
  }`;
}

/**
 * Whether any non-category advanced facet is currently set.
 *
 * @param value - Current filter value object.
 * @returns `true` when Clear filters should be shown.
 */
function hasActiveAdvancedFilters(value: FleetFilterValue): boolean {
  // Return the resulting value to the caller.
  return Boolean(
    // Contribute this line to the enclosing declaration or statement.
    value.transmission ||
      // Contribute this line to the enclosing declaration or statement.
      value.fuelType ||
      // Contribute this line to the enclosing declaration or statement.
      value.seatsMin ||
      // Contribute this line to the enclosing declaration or statement.
      value.seatsMax ||
      // Contribute this line to the enclosing declaration or statement.
      value.priceMin ||
      // Contribute this line to the enclosing declaration or statement.
      value.priceMax,
  );
}

/**
 * Category pills plus optional transmission/fuel/seats/price filters.
 *
 * @param props.categories - Category options from the API.
 * @param props.value - Controlled filter state (without page).
 * @param props.onChange - Called with the next filter object.
 * @returns Filter toolbar UI.
 */
export function CarFleetFilters({ categories, value, onChange }: CarFleetFiltersProps) {
  /** Merge a partial update into the controlled filter value. */
  const patch = (partial: Partial<FleetFilterValue>) => {
    // Call onChange to perform this step.
    onChange({ ...value, ...partial });
  };

  /** Reset advanced facets while preserving the selected category. */
  const clearAdvanced = () => {
    // Call onChange to perform this step.
    onChange({
      // Provide the category id field value.
      categoryId: value.categoryId,
      // Provide the transmission field value.
      transmission: undefined,
      // Provide the fuel type field value.
      fuelType: undefined,
      // Provide the seats min field value.
      seatsMin: undefined,
      // Provide the seats max field value.
      seatsMax: undefined,
      // Provide the price min field value.
      priceMin: undefined,
      // Provide the price max field value.
      priceMax: undefined,
    });
  };

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0 space-y-4">
      {categories.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-2">
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

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

/**
 * Serialize fleet filters into URLSearchParams keys (skips empty).
 *
 * @param params - Mutable query object to update in place.
 * @param filters - Current fleet filter value.
 * @remarks Side effect: mutates `params` (sets or deletes filter keys).
 */
export function applyFleetFiltersToParams(
  // Provide the params field value.
  params: URLSearchParams,
  // Provide the filters field value.
  filters: FleetFilterValue,
// Continue the surrounding logic with this statement.
): void {
  // Continue the surrounding logic with this statement.
  const entries: Array<[string, string | number | undefined]> = [
    // Contribute this line to the enclosing declaration or statement.
    ['categoryId', filters.categoryId],
    // Contribute this line to the enclosing declaration or statement.
    ['transmission', filters.transmission],
    // Contribute this line to the enclosing declaration or statement.
    ['fuelType', filters.fuelType],
    // Contribute this line to the enclosing declaration or statement.
    ['seatsMin', filters.seatsMin],
    // Contribute this line to the enclosing declaration or statement.
    ['seatsMax', filters.seatsMax],
    // Contribute this line to the enclosing declaration or statement.
    ['priceMin', filters.priceMin],
    // Contribute this line to the enclosing declaration or statement.
    ['priceMax', filters.priceMax],
  ];

  // Iterate using the loop initializer, condition, and step.
  for (const [key, raw] of entries) {
    // Evaluate the condition and enter the branch when it is true.
    if (raw === undefined || raw === '') {
      // Call params.delete to perform this step.
      params.delete(key);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Call params.set to perform this step.
      params.set(key, String(raw));
    }
  }
}

/**
 * Parse fleet filter fields from the current URL query.
 *
 * @param params - URL search params from the router.
 * @returns Filter value object with undefined for missing/invalid fields.
 */
export function fleetFiltersFromUrl(params: URLSearchParams): FleetFilterValue {
  // Create the category raw constant.
  const categoryRaw = params.get('categoryId');
  // Create the category id constant.
  const categoryId = categoryRaw ? Number(categoryRaw) : NaN;

  // Return the resulting value to the caller.
  return {
    // Reject non-positive / non-numeric category ids.
    categoryId: Number.isFinite(categoryId) && categoryId > 0 ? categoryId : undefined,
    // Provide the transmission field value.
    transmission: params.get('transmission') || undefined,
    // Provide the fuel type field value.
    fuelType: params.get('fuelType') || undefined,
    // Provide the seats min field value.
    seatsMin: params.get('seatsMin') || undefined,
    // Provide the seats max field value.
    seatsMax: params.get('seatsMax') || undefined,
    // Provide the price min field value.
    priceMin: params.get('priceMin') || undefined,
    // Provide the price max field value.
    priceMax: params.get('priceMax') || undefined,
  };
}
