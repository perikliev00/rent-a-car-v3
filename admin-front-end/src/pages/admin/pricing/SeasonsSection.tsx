/**
 * Seasonal price adjustment CRUD.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  createSeason,
  // Contribute this line to the enclosing declaration or statement.
  deleteSeason,
  // Contribute this line to the enclosing declaration or statement.
  updateSeason,
  // Declare the PricingSeason TypeScript type alias.
  type PricingSeason,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/pricing';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Import named exports from './PricingSection'.
import { PricingSection } from './PricingSection';

/**
 * Seasonal price adjustment list with create/update/delete.
 * @param seasons - Season rows from the pricing bundle
 */
export function SeasonsSection({ seasons }: { seasons: PricingSeason[] }) {
  // Create the query client constant.
  const queryClient = useQueryClient();

  // Create when `id` omitted; update when present.
  const seasonMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: (payload: { id?: number; data: Omit<PricingSeason, 'id'> }) =>
      // Continue the surrounding logic with this statement.
      payload.id ? updateSeason(payload.id, payload.data) : createSeason(payload.data),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      // Call toast to perform this step.
      toast('Season saved', 'success');
    },
    // Provide the on error field value.
    onError: (e) => toast((e as Error).message, 'error'),
  });

  // Create the delete season mutation constant.
  const deleteSeasonMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: deleteSeason,
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      // Call toast to perform this step.
      toast('Season deleted', 'success');
    },
    // Provide the on error field value.
    onError: (e) => toast((e as Error).message, 'error'),
  });

  // Return control to the caller with the following value.
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

/**
 * Editable season row with local draft state until Save/Delete.
 * @param season - Season from the server
 * @param onSave - Persist the draft (without id)
 * @param onDelete - Delete this season
 */
function SeasonRow({
  // Contribute this line to the enclosing declaration or statement.
  season,
  // Contribute this line to the enclosing declaration or statement.
  onSave,
  // Contribute this line to the enclosing declaration or statement.
  onDelete,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the season field value.
  season: PricingSeason;
  // Provide the on save field value.
  onSave: (data: Omit<PricingSeason, 'id'>) => void;
  // Provide the on delete field value.
  onDelete: () => void;
// Continue the surrounding logic with this statement.
}) {
  // Destructure array values into local variables.
  const [draft, setDraft] = useState(season);
  // Return control to the caller with the following value.
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
