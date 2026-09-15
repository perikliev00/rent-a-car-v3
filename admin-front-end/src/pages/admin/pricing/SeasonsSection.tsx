import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createSeason,
  deleteSeason,
  updateSeason,
  type PricingSeason,
} from '../../../api/admin/pricing';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/toastStore';
import { PricingSection } from './PricingSection';

export function SeasonsSection({ seasons }: { seasons: PricingSeason[] }) {
  const queryClient = useQueryClient();

  const seasonMutation = useMutation({
    mutationFn: (payload: { id?: number; data: Omit<PricingSeason, 'id'> }) =>
      payload.id ? updateSeason(payload.id, payload.data) : createSeason(payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      toast('Season saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: deleteSeason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      toast('Season deleted', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  return (
    <PricingSection title="Seasons">
      <div className="space-y-4">
        {seasons.map((s) => (
          <SeasonRow
            key={s.id}
            season={s}
            onSave={(data) => seasonMutation.mutate({ id: s.id, data })}
            onDelete={() => deleteSeasonMutation.mutate(s.id)}
          />
        ))}
        <Button
          variant="outline"
          onClick={() =>
            seasonMutation.mutate({
              data: {
                name: 'High season',
                startMonth: 6,
                startDay: 1,
                endMonth: 8,
                endDay: 31,
                adjType: 'percent',
                adjValue: 20,
                active: true,
              },
            })
          }
        >
          Add high season (Jun–Aug +20%)
        </Button>
      </div>
    </PricingSection>
  );
}

function SeasonRow({
  season,
  onSave,
  onDelete,
}: {
  season: PricingSeason;
  onSave: (data: Omit<PricingSeason, 'id'>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(season);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-[var(--color-line)] p-3 sm:grid-cols-2 lg:grid-cols-6">
      <Input
        label="Name"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <Input
        label="Start M"
        type="number"
        value={draft.startMonth}
        onChange={(e) => setDraft({ ...draft, startMonth: Number(e.target.value) })}
      />
      <Input
        label="Start D"
        type="number"
        value={draft.startDay}
        onChange={(e) => setDraft({ ...draft, startDay: Number(e.target.value) })}
      />
      <Input
        label="End M"
        type="number"
        value={draft.endMonth}
        onChange={(e) => setDraft({ ...draft, endMonth: Number(e.target.value) })}
      />
      <Input
        label="End D"
        type="number"
        value={draft.endDay}
        onChange={(e) => setDraft({ ...draft, endDay: Number(e.target.value) })}
      />
      <Input
        label="Value"
        type="number"
        value={draft.adjValue}
        onChange={(e) => setDraft({ ...draft, adjValue: Number(e.target.value) })}
      />
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-2">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
        />
        Active ({draft.adjType})
      </label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <Button
          variant="outline"
          onClick={() =>
            onSave({
              name: draft.name,
              startMonth: draft.startMonth,
              startDay: draft.startDay,
              endMonth: draft.endMonth,
              endDay: draft.endDay,
              adjType: draft.adjType,
              adjValue: draft.adjValue,
              active: draft.active,
            })
          }
        >
          Save
        </Button>
        <Button variant="outline" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
