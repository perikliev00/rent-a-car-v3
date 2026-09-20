import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ADMIN_OPS_STATUS_OPTIONS,
  REFUNDABLE_OPS_STATUSES,
  changeReservationStatus,
  refundReservation,
  type OpsReservationRow,
  type ReservationOpsStatus,
} from '../../../api/admin/reservations';
import { useAuth } from '../../../auth/useAuth';
import { hasPermission } from '../../../auth/permissions';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { toast } from '../../../components/ui/toastStore';
import { noteLocalAdminMutation } from '../../../hooks/useAdminRealtime';
import { RefundConfirmModal } from '../refund/RefundConfirmModal';

export function StatusActions({
  row,
  onChanged,
  allowRefund = false,
}: {
  row: OpsReservationRow;
  onChanged: () => void;
  allowRefund?: boolean;
}) {
  const { user } = useAuth();
  const canRefund = hasPermission(user, 'can_refund_payments');
  const ledgerStatus = row.refundOperation?.status;
  const refundPending = ledgerStatus === 'pending';
  const showRefund =
    allowRefund &&
    canRefund &&
    REFUNDABLE_OPS_STATUSES.includes(row.status) &&
    row.status !== 'refunded' &&
    ledgerStatus !== 'succeeded';

  const [status, setStatus] = useState<ReservationOpsStatus | ''>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      changeReservationStatus(row.id, {
        status: status as ReservationOpsStatus,
        reason: 'admin_ops_dashboard',
      }),
    onSuccess: () => {
      toast('Status updated', 'success');
      setStatus('');
      noteLocalAdminMutation();
      onChanged();
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const refundMutation = useMutation({
    mutationFn: (reason: string) => refundReservation(row.id, { reason }),
    onSuccess: (result) => {
      if (result.status === 'pending') {
        toast('Refund in progress — waiting for Stripe confirmation', 'info');
      } else {
        toast('Refund completed', 'success');
      }
      setConfirmOpen(false);
      onChanged();
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const options = useMemo(
    () => [
      { value: '', label: 'Change…' },
      ...ADMIN_OPS_STATUS_OPTIONS.filter((s) => s !== row.status).map((s) => ({
        value: s,
        label: s,
      })),
    ],
    [row.status]
  );

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
