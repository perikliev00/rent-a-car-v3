import { useQuery } from '@tanstack/react-query';
import { getLocations } from '../../api/locations';
import type { LocationId, SearchParams } from '../../types/api';
import { DateSelect } from '../ui/DateSelect';
import { DropdownSelect } from '../ui/DropdownSelect';
import { TimeSelect } from '../ui/TimeSelect';
import { Button } from '../ui/Button';

interface SearchFormProps {
  values: SearchParams;
  onChange: (values: SearchParams) => void;
  onSubmit: () => void;
  loading?: boolean;
  compact?: boolean;
  tone?: 'light' | 'onDark';
  submitLabel?: string;
}

export function SearchForm({
  values,
  onChange,
  onSubmit,
  loading,
  compact,
  tone = 'light',
  submitLabel = 'Get your quote',
}: SearchFormProps) {
  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
    staleTime: 1000 * 60 * 30,
  });

  const locationOptions =
    locationsData?.locations.map((l) => ({ value: l.id, label: l.label })) ?? [
      { value: 'office', label: 'Office' },
    ];

  const set = <K extends keyof SearchParams>(key: K, val: SearchParams[K]) => {
    onChange({ ...values, [key]: val });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`grid gap-4 ${compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'}`}
    >
      <DateSelect
        label="Pickup date"
        value={values.pickupDate}
        min={new Date().toISOString().split('T')[0]}
        onChange={(next) => {
          const nextValues: SearchParams = { ...values, pickupDate: next };
          if (nextValues.returnDate < next) {
            nextValues.returnDate = next;
          }
          onChange(nextValues);
        }}
        required
        tone={tone}
      />
      <DateSelect
        label="Return date"
        value={values.returnDate}
        min={values.pickupDate}
        onChange={(next) => set('returnDate', next)}
        required
        tone={tone}
      />
      <TimeSelect
        label="Pickup time"
        value={values.pickupTime}
        onChange={(next) => set('pickupTime', next)}
        tone={tone}
      />
      <TimeSelect
        label="Return time"
        value={values.returnTime}
        onChange={(next) => set('returnTime', next)}
        tone={tone}
      />
      <DropdownSelect
        label="Pickup location"
        value={values.pickupLocation}
        onChange={(next) => set('pickupLocation', next as LocationId)}
        options={locationOptions}
        tone={tone}
      />
      <DropdownSelect
        label="Return location"
        value={values.returnLocation}
        onChange={(next) => set('returnLocation', next as LocationId)}
        options={locationOptions}
        tone={tone}
      />
      <div
        className={
          compact ? 'sm:col-span-2 lg:col-span-3' : 'sm:col-span-2 lg:col-span-6 xl:col-span-6'
        }
      >
        <Button
          type="submit"
          size="lg"
          loading={loading}
          className={`w-full uppercase tracking-[0.08em] sm:w-auto ${tone === 'onDark' ? 'sm:ml-auto sm:flex' : ''}`}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
