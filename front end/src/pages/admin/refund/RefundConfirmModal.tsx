import { useEffect, useState } from 'react';
import type { OpsReservationRow } from '../../../api/admin/reservations';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Textarea } from '../../../components/ui/Textarea';
import { formatRefundMoney } from './refundFormat';

export function RefundConfirmModal({
  open,
  row,
  isPending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  row: OpsReservationRow;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const money = formatRefundMoney(row);

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Confirm refund">
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-ink)]">
          Reservation <span className="font-mono font-semibold">#{row.id}</span>
        </p>
        {money ? (
          <p className="text-sm text-[var(--color-ink)]">
            Amount: <span className="font-semibold">{money}</span>
          </p>
        ) : (
          <p className="text-sm text-[var(--color-danger)]">Refund amount is missing. Cannot confirm.</p>
        )}
        <p className="text-sm text-[var(--color-danger)]">
          This returns the money via Stripe and cannot be undone.
        </p>
        <Textarea
          label="Reason (optional)"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={!money || isPending}
            loading={isPending}
            onClick={() => onConfirm(reason.trim())}
          >
            Confirm refund
          </Button>
        </div>
      </div>
    </Modal>
  );
}
