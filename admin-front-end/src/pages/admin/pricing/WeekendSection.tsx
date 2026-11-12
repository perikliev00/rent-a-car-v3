/**
 * Weekend/weekday surcharge rule editor.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  updateWeekend,
  // Declare the PricingWeekendRule TypeScript type alias.
  type PricingWeekendRule,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/pricing';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Import named exports from './PricingSection'.
import { PricingSection } from './PricingSection';

/**
 * Editor for the weekend/weekday surcharge rule.
 * Field blur/change persists via {@link updateWeekend}.
 *
 * @param rule - Current weekend rule from the pricing bundle
 */
export function WeekendSection({ rule }: { rule: PricingWeekendRule | undefined }) {
  // Create the query client constant.
  const queryClient = useQueryClient();

  // Create the weekend mutation constant.
  const weekendMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: updateWeekend,
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      // Call toast to perform this step.
      toast('Weekend rule saved', 'success');
    },
    // Provide the on error field value.
    onError: (e) => toast((e as Error).message, 'error'),
  });

  // Create the weekend constant.
  const weekend = rule;

  // Return control to the caller with the following value.
  return (
    <PricingSection title="Weekend pricing">
      {weekend && (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
