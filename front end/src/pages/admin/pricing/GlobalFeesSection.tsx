import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateGlobalFee,
  type PricingBundle,
} from '../../../api/admin/pricing';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/toastStore';
import { PricingSection } from './PricingSection';

export function GlobalFeesSection({ fees }: { fees: PricingBundle['globalFees'] }) {
  const queryClient = useQueryClient();

  const globalFeeMutation = useMutation({
    mutationFn: ({
      feeKey,
      ...rest
    }: {
      feeKey: string;
      label: string;
      amount: number;
      mode: 'flat' | 'per_day';
      active: boolean;
    }) => updateGlobalFee(feeKey, rest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] });
      toast('Fee saved', 'success');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });

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

function GlobalFeeRow({
  fee,
  onSave,
  saving,
}: {
  fee: PricingBundle['globalFees'][0];
  onSave: (data: {
    label: string;
    amount: number;
    mode: 'flat' | 'per_day';
    active: boolean;
  }) => void;
  saving: boolean;
}) {
  const [amount, setAmount] = useState(String(fee.amount));
  const [active, setActive] = useState(fee.active);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-line)] p-3">
      <div className="min-w-[10rem]">
        <p className="text-xs text-[var(--color-muted)]">Fee</p>
        <p className="font-medium">{fee.label}</p>
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
