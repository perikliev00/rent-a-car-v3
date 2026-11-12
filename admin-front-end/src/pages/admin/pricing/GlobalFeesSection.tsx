/**
 * Global flat/per-day fee editors (hotel, late, fuel, etc.).
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  updateGlobalFee,
  // Declare the PricingBundle TypeScript type alias.
  type PricingBundle,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/pricing';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Import named exports from './PricingSection'.
import { PricingSection } from './PricingSection';

/**
 * Global flat/per-day fee editors (hotel, late return, fuel, etc.).
 * @param fees - Global fee rows from the pricing bundle
 */
export function GlobalFeesSection({ fees }: { fees: PricingBundle['globalFees'] }) {
  // Create the query client constant.
  const queryClient = useQueryClient();

  // Create the global fee mutation constant.
  const globalFeeMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: ({
      // Contribute this line to the enclosing declaration or statement.
      feeKey,
      // Spread rest into the surrounding structure.
      ...rest
    // Contribute this line to the enclosing declaration or statement.
    }: {
      // Provide the fee key field value.
      feeKey: string;
      // Provide the label field value.
      label: string;
      // Provide the amount field value.
      amount: number;
      // Provide the mode field value.
      mode: 'flat' | 'per_day';
      // Provide the active field value.
      active: boolean;
    // Continue the surrounding logic with this statement.
    }) => updateGlobalFee(feeKey, rest),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      // Call toast to perform this step.
      toast('Fee saved', 'success');
    },
    // Provide the on error field value.
    onError: (e) => toast((e as Error).message, 'error'),
  });

  // Return control to the caller with the following value.
  return (
    <PricingSection title="Global fees" hint="Hotel delivery, late return, and fuel fees.">
      <div className="space-y-4">
        {fees.map((fee) => (
          <GlobalFeeRow
            key={fee.feeKey}
            fee={fee}
            saving={globalFeeMutation.isPending}
            onSave={(data) => globalFeeMutation.mutate({ feeKey: fee.feeKey, ...data })}
          />
        ))}
      </div>
    </PricingSection>
  );
}

/**
 * Single global-fee row with local amount/active state until Save.
 * @param fee - Fee definition from the bundle
 * @param onSave - Persist current local edits
 * @param saving - Disable Save while the mutation is in flight
 */
function GlobalFeeRow({
  // Contribute this line to the enclosing declaration or statement.
  fee,
  // Contribute this line to the enclosing declaration or statement.
  onSave,
  // Contribute this line to the enclosing declaration or statement.
  saving,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the fee field value.
  fee: PricingBundle['globalFees'][0];
  // Provide the on save field value.
  onSave: (data: {
    // Provide the label field value.
    label: string;
    // Provide the amount field value.
    amount: number;
    // Provide the mode field value.
    mode: 'flat' | 'per_day';
    // Provide the active field value.
    active: boolean;
  // Continue the surrounding logic with this statement.
  }) => void;
  // Provide the saving field value.
  saving: boolean;
// Continue the surrounding logic with this statement.
}) {
  // Destructure array values into local variables.
  const [amount, setAmount] = useState(String(fee.amount));
  // Destructure array values into local variables.
  const [active, setActive] = useState(fee.active);
  // Return control to the caller with the following value.
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-3 rounded-lg border border-[var(--color-line)] p-3">
      <div className="min-w-0 sm:min-w-[10rem]">
        <p className="text-xs text-[var(--color-muted)]">Fee</p>
        <p className="break-words font-medium">{fee.label}</p>
        <p className="font-mono text-xs text-[var(--color-muted)]">{fee.feeKey}</p>
      </div>
      <Input label="Amount (€)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <Button
        variant="outline"
        loading={saving}
        onClick={() =>
          onSave({ label: fee.label, amount: Number(amount) || 0, mode: fee.mode, active })
        }
      >
        Save
      </Button>
    </div>
  );
}
