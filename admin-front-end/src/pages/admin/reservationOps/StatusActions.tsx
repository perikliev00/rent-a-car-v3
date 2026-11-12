/**
 * Permission-gated status change + refund action controls.
 */
import { useMemo, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  ADMIN_OPS_STATUS_OPTIONS,
  // Contribute this line to the enclosing declaration or statement.
  REFUNDABLE_OPS_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  changeReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  refundReservation,
  // Declare the OpsReservationRow TypeScript type alias.
  type OpsReservationRow,
  // Declare the ReservationOpsStatus TypeScript type alias.
  type ReservationOpsStatus,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/reservations';
// Import named exports from '../../../auth/useAuth'.
import { useAuth } from '../../../auth/useAuth';
// Import named exports from '../../../auth/permissions'.
import { hasPermission } from '../../../auth/permissions';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Select'.
import { Select } from '../../../components/ui/Select';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Import named exports from '../../../hooks/useAdminRealtime'.
import { noteLocalAdminMutation } from '../../../hooks/useAdminRealtime';
// Import named exports from '../refund/RefundConfirmModal'.
import { RefundConfirmModal } from '../refund/RefundConfirmModal';

/** Permission-gated status change + refund action controls. */
export function StatusActions({
  // Contribute this line to the enclosing declaration or statement.
  row,
  // Contribute this line to the enclosing declaration or statement.
  onChanged,
  // Update allowRefund with the right-hand side value.
  allowRefund = false,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the row field value.
  row: OpsReservationRow;
  // Provide the on changed field value.
  onChanged: () => void;
  // Contribute this line to the enclosing declaration or statement.
  allowRefund?: boolean;
// Continue the surrounding logic with this statement.
}) {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Create the can refund constant.
  const canRefund = hasPermission(user, 'can_refund_payments');
  // Create the ledger status constant.
  const ledgerStatus = row.refundOperation?.status;
  // Create the refund pending constant.
  const refundPending = ledgerStatus === 'pending';
  // Hide refund when already succeeded or reservation is past refundable statuses.
  const showRefund =
    // Contribute this line to the enclosing declaration or statement.
    allowRefund &&
    // Contribute this line to the enclosing declaration or statement.
    canRefund &&
    // Call REFUNDABLE_OPS_STATUSES.includes to perform this step.
    REFUNDABLE_OPS_STATUSES.includes(row.status) &&
    // Continue the surrounding logic with this statement.
    row.status !== 'refunded' &&
    // Continue the surrounding logic with this statement.
    ledgerStatus !== 'succeeded';

  // Destructure array values into local variables.
  const [status, setStatus] = useState<ReservationOpsStatus | ''>('');
  // Destructure array values into local variables.
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Create the mutation constant.
  const mutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () =>
      // Call changeReservationStatus to perform this step.
      changeReservationStatus(row.id, {
        // Provide the status field value.
        status: status as ReservationOpsStatus,
        // Provide the reason field value.
        reason: 'admin_ops_dashboard',
      }),
    // Provide the on success field value.
    onSuccess: () => {
      // Call toast to perform this step.
      toast('Status updated', 'success');
      // Call setStatus to perform this step.
      setStatus('');
      // Avoid duplicate SSE toast for the mutation we just performed.
      noteLocalAdminMutation();
      // Call onChanged to perform this step.
      onChanged();
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the refund mutation constant.
  const refundMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: (reason: string) => refundReservation(row.id, { reason }),
    // Provide the on success field value.
    onSuccess: (result) => {
      // Evaluate the condition and enter the branch when it is true.
      if (result.status === 'pending') {
        // Call toast to perform this step.
        toast('Refund in progress — waiting for Stripe confirmation', 'info');
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Call toast to perform this step.
        toast('Refund completed', 'success');
      }
      // Call setConfirmOpen to perform this step.
      setConfirmOpen(false);
      // Call onChanged to perform this step.
      onChanged();
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the options constant.
  const options = useMemo(
    // Continue the surrounding logic with this statement.
    () => [
      // Contribute this line to the enclosing declaration or statement.
      { value: '', label: 'Change…' },
      // Call ...ADMIN_OPS_STATUS_OPTIONS.filter to perform this step.
      ...ADMIN_OPS_STATUS_OPTIONS.filter((s) => s !== row.status).map((s) => ({
        // Provide the value field value.
        value: s,
        // Provide the label field value.
        label: s,
      })),
    ],
    // Contribute this line to the enclosing declaration or statement.
    [row.status]
  );

  // Return control to the caller with the following value.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={status}
        onChange={(e) => setStatus(e.target.value as ReservationOpsStatus | '')}
        className="min-w-[9rem] text-xs"
        options={options}
      />
      <Button
        size="sm"
        disabled={!status || mutation.isPending || refundMutation.isPending}
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Apply
      </Button>
      {showRefund ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={refundPending || mutation.isPending || refundMutation.isPending}
          loading={refundMutation.isPending}
          title={refundPending ? 'Refund already in progress' : undefined}
          onClick={() => {
            if (!refundPending) setConfirmOpen(true);
          }}
        >
          {ledgerStatus === 'failed' ? 'Retry refund' : 'Refund'}
        </Button>
      ) : null}
      <RefundConfirmModal
        open={confirmOpen}
        row={row}
        isPending={refundMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={(reason) =>
          refundMutation.mutate(reason || 'admin_ops_dashboard_refund')
        }
      />
    </div>
  );
}
