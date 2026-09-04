import { useState } from 'react';
import { formatISO } from 'date-fns';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import type { CalendarFiltersState, CalendarViewMode } from './calendar.types';
import { PROBLEM_EVENT_TYPES } from './eventStyles';

const FILTER_LABELS: Partial<Record<keyof CalendarFiltersState, string>> = {
  location: 'Location',
  carStatus: 'Car status',
  transmission: 'Transmission',
  fuelType: 'Fuel',
  reservationStatus: 'Reservation',
  eventType: 'Event type',
  categoryId: 'Category',
  staffUserId: 'Staff',
};

export function CalendarFilters({
  filters,
  onChange,
  onClear,
  view,
  onApplyPreset,
  compact = false,
}: {
  filters: CalendarFiltersState;
  onChange: <K extends keyof CalendarFiltersState>(key: K, value: CalendarFiltersState[K]) => void;
  onClear: () => void;
  view: CalendarViewMode;
  onApplyPreset: (preset: CalendarPreset) => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const activeChips = (Object.keys(filters) as (keyof CalendarFiltersState)[])
    .filter((k) => Boolean(filters[k]))
    .map((k) => ({
      key: k,
      label: `${FILTER_LABELS[k] || k}: ${filters[k]}`,
    }));

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

export type CalendarPreset = {
  kind: string;
  view?: CalendarViewMode;
  date?: string;
  carStatus?: string;
  reservationStatus?: string;
  eventType?: string;
};
