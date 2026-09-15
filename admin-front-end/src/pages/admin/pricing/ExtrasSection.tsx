import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateExtra,
  type PricingExtra,
} from '../../../api/admin/pricing';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/toastStore';
import { PricingSection } from './PricingSection';

export function ExtrasSection({ extras }: { extras: PricingExtra[] }) {
  const queryClient = useQueryClient();

  const extraMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<PricingExtra>) => updateExtra(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      toast('Extra saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  return (
    <PricingSection title="Extras catalog">
      <div className="space-y-3">
        {extras.map((extra) => (
          <div key={extra.id} className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-[var(--color-line)] p-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-xs text-[var(--color-muted)]">Code</p>
              <p className="font-mono text-sm">{extra.code}</p>
            </div>
            <Input
              label="Label"
              defaultValue={extra.label}
              onBlur={(e) => extraMutation.mutate({ id: extra.id, label: e.target.value })}
            />
            <Input
              label="Amount (€)"
              type="number"
              defaultValue={extra.amount}
              onBlur={(e) => extraMutation.mutate({ id: extra.id, amount: Number(e.target.value) || 0 })}
            />
            <Input
              label="Mode"
              defaultValue={extra.mode}
              onBlur={(e) =>
                extraMutation.mutate({
                  id: extra.id,
                  mode: e.target.value === 'per_day' ? 'per_day' : 'flat',
                })
              }
            />
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={extra.active}
                onChange={(e) => extraMutation.mutate({ id: extra.id, active: e.target.checked })}
              />
              Active
            </label>
          </div>
        ))}
      </div>
    </PricingSection>
  );
}
