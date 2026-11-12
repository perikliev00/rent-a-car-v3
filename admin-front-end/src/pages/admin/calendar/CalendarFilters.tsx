/**
 * Filter controls for fleet calendar event queries.
 */
import { useState } from 'react';
// Import named exports from 'date-fns'.
import { formatISO } from 'date-fns';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/Select'.
import { Select } from '../../../components/ui/Select';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarFiltersState, CalendarViewMode } from './calendar.types';
// Import named exports from './eventStyles'.
import { PROBLEM_EVENT_TYPES } from './eventStyles';

// Continue the surrounding logic with this statement.
const FILTER_LABELS: Partial<Record<keyof CalendarFiltersState, string>> = {
  // Provide the location field value.
  location: 'Location',
  // Provide the car status field value.
  carStatus: 'Car status',
  // Provide the transmission field value.
  transmission: 'Transmission',
  // Provide the fuel type field value.
  fuelType: 'Fuel',
  // Provide the reservation status field value.
  reservationStatus: 'Reservation',
  // Provide the event type field value.
  eventType: 'Event type',
  // Provide the category id field value.
  categoryId: 'Category',
  // Provide the staff user id field value.
  staffUserId: 'Staff',
};

/**
 * Fleet calendar filter panel with chips, presets, and expandable advanced fields.
 *
 * @param filters - Current filter state
 * @param onChange - Update one filter key
 * @param onClear - Reset all filters
 * @param view - Active view (affects which presets make sense)
 * @param onApplyPreset - Apply a named filter/view preset
 * @param compact - Tighter layout for narrow toolbars
 */
export function CalendarFilters({
  // Contribute this line to the enclosing declaration or statement.
  filters,
  // Contribute this line to the enclosing declaration or statement.
  onChange,
  // Contribute this line to the enclosing declaration or statement.
  onClear,
  // Contribute this line to the enclosing declaration or statement.
  view,
  // Contribute this line to the enclosing declaration or statement.
  onApplyPreset,
  // Update compact with the right-hand side value.
  compact = false,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the filters field value.
  filters: CalendarFiltersState;
  // Provide the on change field value.
  onChange: <K extends keyof CalendarFiltersState>(key: K, value: CalendarFiltersState[K]) => void;
  // Provide the on clear field value.
  onClear: () => void;
  // Provide the view field value.
  view: CalendarViewMode;
  // Provide the on apply preset field value.
  onApplyPreset: (preset: CalendarPreset) => void;
  // Contribute this line to the enclosing declaration or statement.
  compact?: boolean;
// Continue the surrounding logic with this statement.
}) {
  // Destructure array values into local variables.
  const [expanded, setExpanded] = useState(false);

  // Chips for non-empty filter values (shown even when the panel is collapsed).
  const activeChips = (Object.keys(filters) as (keyof CalendarFiltersState)[])
    // Call .filter to perform this step.
    .filter((k) => Boolean(filters[k]))
    // Call .map to perform this step.
    .map((k) => ({
      // Provide the key field value.
      key: k,
      // Provide the label field value.
      label: `${FILTER_LABELS[k] || k}: ${filters[k]}`,
    }));

  // Return control to the caller with the following value.
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onApplyPreset({
              kind: 'today_ops',
              view: 'day',
              date: formatISO(new Date(), { representation: 'date' }),
            })
          }
        >
          Today pickups/returns
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onApplyPreset({
              kind: 'problems',
              eventType: PROBLEM_EVENT_TYPES.join(','),
            })
          }
        >
          Problems
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onApplyPreset({ kind: 'needs_cleaning', carStatus: 'needs_cleaning' })}
        >
          Needs cleaning
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onApplyPreset({ kind: 'paid', reservationStatus: 'paid' })}
        >
          Paid not confirmed
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide filters' : 'Filters'}
          {activeChips.length > 0 ? ` (${activeChips.length})` : ''}
        </Button>
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChange(chip.key, '')}
              className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)]"
            >
              {chip.label} ×
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear all
          </Button>
        </div>
      ) : null}

      {expanded ? (
        <div className={`grid gap-3 ${compact ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          <Input
            label="Location"
            value={filters.location}
            onChange={(e) => onChange('location', e.target.value)}
            placeholder="Search location"
          />
          <Select
            label="Car status"
            value={filters.carStatus}
            onChange={(e) => onChange('carStatus', e.target.value)}
            options={[
              { value: '', label: 'Any status' },
              { value: 'available', label: 'Available' },
              { value: 'reserved', label: 'Reserved' },
              { value: 'rented', label: 'Rented' },
              { value: 'needs_cleaning', label: 'Needs cleaning' },
              { value: 'in_maintenance', label: 'Maintenance' },
              { value: 'damaged', label: 'Damaged' },
            ]}
          />
          <Select
            label="Transmission"
            value={filters.transmission}
            onChange={(e) => onChange('transmission', e.target.value)}
            options={[
              { value: '', label: 'Any' },
              { value: 'Automatic', label: 'Automatic' },
              { value: 'Manual', label: 'Manual' },
            ]}
          />
          <Select
            label="Fuel"
            value={filters.fuelType}
            onChange={(e) => onChange('fuelType', e.target.value)}
            options={[
              { value: '', label: 'Any' },
              { value: 'Petrol', label: 'Petrol' },
              { value: 'Diesel', label: 'Diesel' },
              { value: 'Hybrid', label: 'Hybrid' },
              { value: 'Electric', label: 'Electric' },
            ]}
          />
          <Select
            label="Reservation status"
            value={filters.reservationStatus}
            onChange={(e) => onChange('reservationStatus', e.target.value)}
            options={[
              { value: '', label: 'Any' },
              { value: 'paid', label: 'Paid' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'manual_review', label: 'Manual review' },
              { value: 'picked_up', label: 'Picked up' },
              { value: 'active_rental', label: 'Active rental' },
            ]}
          />
          <Select
            label="Event type"
            value={filters.eventType.includes(',') ? '' : filters.eventType}
            onChange={(e) => onChange('eventType', e.target.value)}
            options={[
              { value: '', label: 'All events' },
              { value: 'reservation', label: 'Reservation' },
              { value: 'pickup', label: 'Pickup' },
              { value: 'return', label: 'Return' },
              { value: 'blocked', label: 'Blocked' },
              { value: 'task', label: 'Task' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'cleaning', label: 'Cleaning' },
              { value: 'payment_issue', label: 'Payment issue' },
            ]}
          />
          <div className="flex items-end text-xs text-[var(--color-muted)]">
            View: {view}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Export the calendar preset type.
export type CalendarPreset = {
  // Provide the kind field value.
  kind: string;
  // Contribute this line to the enclosing declaration or statement.
  view?: CalendarViewMode;
  // Contribute this line to the enclosing declaration or statement.
  date?: string;
  // Contribute this line to the enclosing declaration or statement.
  carStatus?: string;
  // Contribute this line to the enclosing declaration or statement.
  reservationStatus?: string;
  // Contribute this line to the enclosing declaration or statement.
  eventType?: string;
};
