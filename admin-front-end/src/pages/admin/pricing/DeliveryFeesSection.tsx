import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateDeliveryFees,
  type PricingDeliveryFee,
} from '../../../api/admin/pricing';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/toastStore';
import { LOCATION_LABELS } from './pricingConstants';
import { PricingSection } from './PricingSection';

export function DeliveryFeesSection({ fees }: { fees: PricingDeliveryFee[] }) {
  const queryClient = useQueryClient();
  const [feeDraft, setFeeDraft] = useState<Record<string, string> | null>(null);

  const feesMutation = useMutation({
    mutationFn: updateDeliveryFees,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      toast('Delivery fees saved', 'success');
      setFeeDraft(null);
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const feeValues = useMemo(() => {
    if (feeDraft) return feeDraft;
    return Object.fromEntries(fees.map((f) => [f.locationId, String(f.fee)]));
  }, [fees, feeDraft]);

  return (
    <PricingSection
      title="Delivery fees"
      hint="Pickup and return location fees (EUR). Airport locations are included."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
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
