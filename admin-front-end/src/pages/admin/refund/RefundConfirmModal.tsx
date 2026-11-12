/**
 * Confirm dialog before initiating a reservation refund.
 */
import { useEffect, useState } from 'react';
// Contribute this line to the enclosing declaration or statement.
import type { OpsReservationRow } from '../../../api/admin/reservations';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Modal'.
import { Modal } from '../../../components/ui/Modal';
// Import named exports from '../../../components/ui/Textarea'.
import { Textarea } from '../../../components/ui/Textarea';
// Import named exports from './refundFormat'.
import { formatRefundMoney } from './refundFormat';

/** Confirm dialog before initiating a reservation refund. */
export function RefundConfirmModal({
  // Contribute this line to the enclosing declaration or statement.
  open,
  // Contribute this line to the enclosing declaration or statement.
  row,
  // Contribute this line to the enclosing declaration or statement.
  isPending,
  // Contribute this line to the enclosing declaration or statement.
  onClose,
  // Contribute this line to the enclosing declaration or statement.
  onConfirm,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the open field value.
  open: boolean;
  // Provide the row field value.
  row: OpsReservationRow;
  // Provide the is pending field value.
  isPending: boolean;
  // Provide the on close field value.
  onClose: () => void;
  // Provide the on confirm field value.
  onConfirm: (reason: string) => void;
// Continue the surrounding logic with this statement.
}) {
  // Destructure array values into local variables.
  const [reason, setReason] = useState('');
  // Create the money constant.
  const money = formatRefundMoney(row);

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (open) setReason('');
  // Continue the surrounding logic with this statement.
  }, [open]);

  // Return control to the caller with the following value.
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
