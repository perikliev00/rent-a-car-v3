/**
 * Per-location delivery fee editor.
 */
import { useMemo, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  updateDeliveryFees,
  // Declare the PricingDeliveryFee TypeScript type alias.
  type PricingDeliveryFee,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/pricing';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Import named exports from './pricingConstants'.
import { LOCATION_LABELS } from './pricingConstants';
// Import named exports from './PricingSection'.
import { PricingSection } from './PricingSection';

/**
 * Editable per-location delivery fees with a local draft until Save.
 * @param fees - Delivery fee rows from the pricing bundle
 */
export function DeliveryFeesSection({ fees }: { fees: PricingDeliveryFee[] }) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Local edit buffer; null means “show server values”.
  const [feeDraft, setFeeDraft] = useState<Record<string, string> | null>(null);

  // Create the fees mutation constant.
  const feesMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: updateDeliveryFees,
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      // Call toast to perform this step.
      toast('Delivery fees saved', 'success');
      // Call setFeeDraft to perform this step.
      setFeeDraft(null);
    },
    // Provide the on error field value.
    onError: (e) => toast((e as Error).message, 'error'),
  });

  // Prefer draft strings while editing; otherwise mirror server fees.
  const feeValues = useMemo(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (feeDraft) return feeDraft;
    // Return the resulting value to the caller.
    return Object.fromEntries(fees.map((f) => [f.locationId, String(f.fee)]));
  // Continue the surrounding logic with this statement.
  }, [fees, feeDraft]);

  // Return control to the caller with the following value.
  return (
    <PricingSection
      title="Delivery fees"
      hint="Pickup and return location fees (EUR). Airport locations are included."
    >
      <div className="min-w-0 overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[20rem] text-left text-sm">
          <thead>
            <tr className="border-b text-[var(--color-muted)]">
              <th className="pb-2 pr-3">Location</th>
              <th className="pb-2">Fee (€)</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((f) => (
              <tr key={f.locationId} className="border-b border-[var(--color-line)]/60">
                <td className="py-2 pr-3">{LOCATION_LABELS[f.locationId] || f.locationId}</td>
                <td className="py-2">
                  <Input
                    type="number"
                    step="0.01"
                    className="max-w-[8rem]"
                    value={feeValues[f.locationId] ?? ''}
                    onChange={(e) =>
                      setFeeDraft({ ...feeValues, [f.locationId]: e.target.value })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        className="mt-4"
        loading={feesMutation.isPending}
        onClick={() =>
          feesMutation.mutate(
            Object.entries(feeValues).map(([locationId, fee]) => ({
              locationId,
              fee: Number(fee) || 0,
            }))
          )
        }
      >
        Save delivery fees
      </Button>
    </PricingSection>
  );
}
