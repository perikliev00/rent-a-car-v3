/**
 * Long-rental / early / last-minute discount editors.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  updateDiscount,
  // Declare the PricingDiscountRule TypeScript type alias.
  type PricingDiscountRule,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/pricing';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Import named exports from './PricingSection'.
import { PricingSection } from './PricingSection';

/**
 * Editors for long-rental / early-booking / last-minute discount rules.
 * @param rules - Discount rules from the pricing bundle
 */
export function DiscountsSection({ rules }: { rules: PricingDiscountRule[] }) {
  // Create the query client constant.
  const queryClient = useQueryClient();

  // Wrap so callers pass `{ id, ...fields }` while the API takes (id, data).
  const discountMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: ({
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Spread data into the surrounding structure.
      ...data
    // Contribute this line to the enclosing declaration or statement.
    }: {
      // Provide the id field value.
      id: number;
    // Continue the surrounding logic with this statement.
    } & Partial<{
      // Provide the name field value.
      name: string;
      // Provide the threshold field value.
      threshold: number;
      // Provide the adj type field value.
      adjType: 'percent' | 'fixed';
      // Provide the adj value field value.
      adjValue: number;
      // Provide the active field value.
      active: boolean;
    // Continue the surrounding logic with this statement.
    }>) => updateDiscount(id, data),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      // Call toast to perform this step.
      toast('Discount rule saved', 'success');
    },
    // Provide the on error field value.
    onError: (e) => toast((e as Error).message, 'error'),
  });

  // Return control to the caller with the following value.
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
