import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateDeposit,
  type PricingDepositRule,
} from '../../../api/admin/pricing';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/toastStore';
import { PricingSection } from './PricingSection';

export function DepositSection({ rule }: { rule: PricingDepositRule | undefined }) {
  const queryClient = useQueryClient();

  const depositMutation = useMutation({
    mutationFn: updateDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      toast('Deposit saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const deposit = rule;

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
