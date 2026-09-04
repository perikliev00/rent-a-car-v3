import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateWeekend,
  type PricingWeekendRule,
} from '../../../api/admin/pricing';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/toastStore';
import { PricingSection } from './PricingSection';

export function WeekendSection({ rule }: { rule: PricingWeekendRule | undefined }) {
  const queryClient = useQueryClient();

  const weekendMutation = useMutation({
    mutationFn: updateWeekend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      toast('Weekend rule saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const weekend = rule;

  return (
    <PricingSection title="Weekend pricing">
      {weekend && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Input
            label="Name"
            defaultValue={weekend.name}
            id={`weekend-name`}
            onBlur={(e) =>
              weekendMutation.mutate({
                id: weekend.id,
                name: e.target.value,
                weekdays: weekend.weekdays,
                adjType: weekend.adjType,
                adjValue: weekend.adjValue,
                active: weekend.active,
              })
            }
          />
          <Input
            label="Adjustment %"
            type="number"
            defaultValue={weekend.adjValue}
            onBlur={(e) =>
              weekendMutation.mutate({
                id: weekend.id,
                name: weekend.name,
                weekdays: weekend.weekdays,
                adjType: 'percent',
                adjValue: Number(e.target.value) || 0,
                active: weekend.active,
              })
            }
          />
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              defaultChecked={weekend.active}
              onChange={(e) =>
                weekendMutation.mutate({
                  id: weekend.id,
                  name: weekend.name,
                  weekdays: weekend.weekdays,
                  adjType: weekend.adjType,
                  adjValue: weekend.adjValue,
                  active: e.target.checked,
                })
              }
            />
            Active
          </label>
        </div>
      )}
    </PricingSection>
  );
}
