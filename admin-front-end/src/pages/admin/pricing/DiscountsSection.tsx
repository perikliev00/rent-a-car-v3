import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateDiscount,
  type PricingDiscountRule,
} from '../../../api/admin/pricing';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/toastStore';
import { PricingSection } from './PricingSection';

export function DiscountsSection({ rules }: { rules: PricingDiscountRule[] }) {
  const queryClient = useQueryClient();

  const discountMutation = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number;
    } & Partial<{
      name: string;
      threshold: number;
      adjType: 'percent' | 'fixed';
      adjValue: number;
      active: boolean;
    }>) => updateDiscount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      toast('Discount rule saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  return (
    <PricingSection
      title="Discounts & last-minute"
      hint="Long rental discount is inactive by default so it does not stack with car duration tiers."
    >
      <div className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.id} className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-[var(--color-line)] p-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-xs text-[var(--color-muted)]">Kind</p>
              <p className="font-medium">{rule.kind}</p>
            </div>
            <Input
              label="Name"
              defaultValue={rule.name}
              onBlur={(e) => discountMutation.mutate({ id: rule.id, name: e.target.value })}
            />
            <Input
              label="Threshold"
              type="number"
              defaultValue={rule.threshold}
              onBlur={(e) =>
                discountMutation.mutate({ id: rule.id, threshold: Number(e.target.value) || 0 })
              }
            />
            <Input
              label="Value"
              type="number"
              defaultValue={rule.adjValue}
              onBlur={(e) =>
                discountMutation.mutate({ id: rule.id, adjValue: Number(e.target.value) || 0 })
              }
            />
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={rule.active}
                onChange={(e) => discountMutation.mutate({ id: rule.id, active: e.target.checked })}
              />
              Active
            </label>
          </div>
        ))}
      </div>
    </PricingSection>
  );
}
