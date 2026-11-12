/**
 * Optional extras catalog CRUD for quotes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  updateExtra,
  // Declare the PricingExtra TypeScript type alias.
  type PricingExtra,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/pricing';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Import named exports from './PricingSection'.
import { PricingSection } from './PricingSection';

/**
 * Editable extras catalog rows (label/amount/mode/active).
 * @param extras - Extra rows from the pricing bundle
 */
export function ExtrasSection({ extras }: { extras: PricingExtra[] }) {
  // Create the query client constant.
  const queryClient = useQueryClient();

  // Create the extra mutation constant.
  const extraMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: ({ id, ...data }: { id: number } & Partial<PricingExtra>) => updateExtra(id, data),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      // Call toast to perform this step.
      toast('Extra saved', 'success');
    },
    // Provide the on error field value.
    onError: (e) => toast((e as Error).message, 'error'),
  });

  // Return control to the caller with the following value.
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
