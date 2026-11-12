/**
 * Default deposit rule editor.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  updateDeposit,
  // Declare the PricingDepositRule TypeScript type alias.
  type PricingDepositRule,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/pricing';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Import named exports from './PricingSection'.
import { PricingSection } from './PricingSection';

/**
 * Editor for the default deposit rule (amount + active flag).
 * Saves on blur/change via {@link updateDeposit}.
 *
 * @param rule - Current deposit rule from the pricing bundle (may be undefined)
 */
export function DepositSection({ rule }: { rule: PricingDepositRule | undefined }) {
  // Create the query client constant.
  const queryClient = useQueryClient();

  // Create the deposit mutation constant.
  const depositMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: updateDeposit,
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      // Call toast to perform this step.
      toast('Deposit saved', 'success');
    },
    // Provide the on error field value.
    onError: (e) => toast((e as Error).message, 'error'),
  });

  // Create the deposit constant.
  const deposit = rule;

  // Return control to the caller with the following value.
  return (
    <PricingSection title="Deposit" hint="Shown in breakdown; collected at pickup (not charged in Stripe).">
      {deposit && (
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="Default deposit (€)"
            type="number"
            defaultValue={deposit.defaultAmount}
            onBlur={(e) =>
              depositMutation.mutate({
                id: deposit.id,
                name: deposit.name,
                defaultAmount: Number(e.target.value) || 0,
                active: deposit.active,
              })
            }
          />
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              defaultChecked={deposit.active}
              onChange={(e) =>
                depositMutation.mutate({
                  id: deposit.id,
                  name: deposit.name,
                  defaultAmount: deposit.defaultAmount,
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
