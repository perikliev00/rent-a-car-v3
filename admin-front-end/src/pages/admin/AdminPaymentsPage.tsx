import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPaymentRefundQueue,
  getPayments,
  reconcilePayments,
  type PaymentRefundQueueFilters,
} from '../../api/admin/payments';
import { refundReservation, type OpsReservationRow } from '../../api/admin/reservations';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Loading';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/toastStore';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/permissions';
import { RefundConfirmModal } from './refund/RefundConfirmModal';
import { RefundLedgerBadge } from './refund/RefundLedgerBadge';
import { formatRefundMoney } from './refund/refundFormat';

const STATUS_OPTIONS = [
  { value: '', label: 'All refundable' },
  { value: 'paid', label: 'paid' },
  { value: 'confirmed', label: 'confirmed' },
  { value: 'car_prepared', label: 'car_prepared' },
  { value: 'manual_review', label: 'manual_review' },
];

const REFUND_STATE_OPTIONS = [
  { value: '', label: 'Any ledger' },
  { value: 'none', label: 'none' },
  { value: 'pending', label: 'pending' },
  { value: 'failed', label: 'failed' },
];

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function emptyFilters(): PaymentRefundQueueFilters {
  return { q: '', status: '', refundState: '', pickupFrom: '', pickupTo: '' };
}

function RefundQueueActions({
  row,
  onChanged,
}: {
  row: OpsReservationRow;
  onChanged: () => void;
}) {
  const ledgerStatus = row.refundOperation?.status;
  const refundPending = ledgerStatus === 'pending';
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        disabled={refundPending || refundMutation.isPending}
        loading={refundMutation.isPending}
        title={refundPending ? 'Refund already in progress' : undefined}
        onClick={() => {
          if (!refundPending) setConfirmOpen(true);
        }}
      >
        {ledgerStatus === 'failed' ? 'Retry refund' : 'Refund'}
      </Button>
      <RefundConfirmModal
        open={confirmOpen}
        row={row}
        isPending={refundMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={(reason) => refundMutation.mutate(reason || 'admin_payments_refund')}
      />
    </div>
  );
}

function RefundableTable({
  rows,
  onChanged,
}: {
  rows: OpsReservationRow[];
  onChanged: () => void;
}) {
  if (!rows.length) {
    return <p className="text-sm text-[var(--color-muted)]">No refundable bookings</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b text-[var(--color-muted)]">
            <th className="pb-2 pr-3">Reservation</th>
            <th className="pb-2 pr-3">Order</th>
            <th className="pb-2 pr-3">Car</th>
            <th className="pb-2 pr-3">Customer</th>
            <th className="pb-2 pr-3">Amount</th>
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2 pr-3">Refund ledger</th>
            <th className="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--color-line)]/60">
              <td className="py-2 pr-3 font-mono">#{row.id}</td>
              <td className="py-2 pr-3 font-mono">{row.orderId ? `#${row.orderId}` : '—'}</td>
              <td className="py-2 pr-3">{row.carName || '—'}</td>
              <td className="py-2 pr-3">
                <div>{row.fullName || '—'}</div>
                <div className="text-[var(--color-muted)]">{row.email || ''}</div>
              </td>
              <td className="py-2 pr-3">{formatRefundMoney(row) || '—'}</td>
              <td className="py-2 pr-3">{row.status}</td>
              <td className="py-2 pr-3">
                <RefundLedgerBadge row={row} showNone />
              </td>
              <td className="py-2">
                <RefundQueueActions row={row} onChanged={onChanged} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentRefundsTable({ rows }: { rows: OpsReservationRow[] }) {
  if (!rows.length) {
    return <p className="mt-4 text-sm text-[var(--color-muted)]">No recent refunds</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b text-[var(--color-muted)]">
            <th className="pb-2 pr-3">Reservation</th>
            <th className="pb-2 pr-3">Order</th>
            <th className="pb-2 pr-3">Car</th>
            <th className="pb-2 pr-3">Customer</th>
            <th className="pb-2 pr-3">Amount</th>
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--color-line)]/60">
              <td className="py-2 pr-3 font-mono">#{row.id}</td>
              <td className="py-2 pr-3 font-mono">{row.orderId ? `#${row.orderId}` : '—'}</td>
              <td className="py-2 pr-3">{row.carName || '—'}</td>
              <td className="py-2 pr-3">
                <div>{row.fullName || '—'}</div>
                <div className="text-[var(--color-muted)]">{row.email || ''}</div>
              </td>
              <td className="py-2 pr-3">{formatRefundMoney(row) || '—'}</td>
              <td className="py-2 pr-3">{row.status}</td>
              <td className="py-2">{formatWhen(row.refundOperation?.updatedAt || row.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPaymentsPage() {
  const { user } = useAuth();
  const canRefund = hasPermission(user, 'can_refund_payments');
  const queryClient = useQueryClient();
  const [dryRun, setDryRun] = useState(true);
  const [draft, setDraft] = useState<PaymentRefundQueueFilters>(emptyFilters);
  const [filters, setFilters] = useState<PaymentRefundQueueFilters>(emptyFilters);

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'payments'], queryFn: getPayments });

  const queueQuery = useQuery({
    queryKey: ['admin', 'payments', 'refund-queue', filters],
    queryFn: () => getPaymentRefundQueue(filters),
    enabled: canRefund,
  });

  const reconcileMutation = useMutation({
    mutationFn: () => reconcilePayments(dryRun),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
      toast(`Reconcile ${result.dryRun ? '(dry run) ' : ''}completed`, 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const refreshQueue = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'reservations'] });
  };

  const applyFilters = () => {
    setFilters({
      q: String(draft.q || '').trim(),
      status: draft.status || '',
      refundState: draft.refundState || '',
      pickupFrom: draft.pickupFrom || '',
      pickupTo: draft.pickupTo || '',
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">Payments</h1>
          <p className="mt-1 break-words text-[var(--color-muted)]">
            {data?.unresolvedFailureCount ?? 0} unresolved failure(s)
          </p>
        </div>
        {canRefund ? (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              Dry run
            </label>
            <Button loading={reconcileMutation.isPending} onClick={() => reconcileMutation.mutate()}>
              Reconcile
            </Button>
          </div>
        ) : null}
      </div>

      {canRefund ? (
        <>
          <Card className="mt-8">
            <CardBody>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">Refundable bookings</h2>
                  <p className="break-words text-sm text-[var(--color-muted)]">
                    Paid / confirmed / prepared / manual review · search by reservation or order id
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={refreshQueue}>
                  Refresh
                </Button>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <Input
                  label="Search"
                  placeholder="Reservation or order #"
                  value={draft.q || ''}
                  onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyFilters();
                  }}
                />
                <Select
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={draft.status || ''}
                  onChange={(e) => {
                    const status = e.target.value;
                    setDraft({ ...draft, status });
                    setFilters((prev) => ({ ...prev, status }));
                  }}
                />
                <Select
                  label="Refund state"
                  options={REFUND_STATE_OPTIONS}
                  value={draft.refundState || ''}
                  onChange={(e) => {
                    const refundState = e.target.value;
                    setDraft({ ...draft, refundState });
                    setFilters((prev) => ({ ...prev, refundState }));
                  }}
                />
                <Input
                  label="Pickup from"
                  type="date"
                  value={draft.pickupFrom || ''}
                  onChange={(e) => {
                    const pickupFrom = e.target.value;
                    setDraft({ ...draft, pickupFrom });
                    setFilters((prev) => ({ ...prev, pickupFrom }));
                  }}
                />
                <Input
                  label="Pickup to"
                  type="date"
                  value={draft.pickupTo || ''}
                  onChange={(e) => {
                    const pickupTo = e.target.value;
                    setDraft({ ...draft, pickupTo });
                    setFilters((prev) => ({ ...prev, pickupTo }));
                  }}
                />
                <div className="flex items-end">
                  <Button size="sm" onClick={applyFilters}>
                    Search
                  </Button>
                </div>
              </div>
              {queueQuery.isLoading ? (
                <p className="mt-4 text-sm text-[var(--color-muted)]">Loading refundable bookings…</p>
              ) : (
                <RefundableTable rows={queueQuery.data?.refundable ?? []} onChanged={refreshQueue} />
              )}
            </CardBody>
          </Card>

          <Card className="mt-6">
            <CardBody>
              <h2 className="font-semibold">Recent refunds</h2>
              <p className="text-sm text-[var(--color-muted)]">Succeeded Stripe refunds</p>
              {queueQuery.isLoading ? (
                <p className="mt-4 text-sm text-[var(--color-muted)]">Loading recent refunds…</p>
              ) : (
                <RecentRefundsTable rows={queueQuery.data?.recentRefunds ?? []} />
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      <Card className="mt-8">
        <CardBody>
          <h2 className="font-semibold">Recent events</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-[var(--color-muted)]">
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Session</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {data?.events.slice(0, 20).map((ev) => (
                  <tr key={ev.id} className="border-b border-[var(--color-line)]/60">
                    <td className="py-2 pr-3">{ev.event_type}</td>
                    <td className="py-2 pr-3">{ev.status}</td>
                    <td className="py-2 pr-3 font-mono">{ev.stripe_session_id?.slice(0, 16) ?? '—'}…</td>
                    <td className="py-2">{new Date(ev.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardBody>
          <h2 className="font-semibold text-[var(--color-danger)]">Failures</h2>
          <div className="mt-4 space-y-3">
            {data?.failures.map((f) => (
              <div key={f.id} className="rounded-lg border border-[var(--color-danger)]/20 bg-red-50 p-3 text-sm">
                <p className="font-medium">{f.reason}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {f.resolved ? 'Resolved' : 'Unresolved'} · {new Date(f.created_at).toLocaleString()}
                </p>
              </div>
            ))}
            {data?.failures.length === 0 && <p className="text-[var(--color-muted)]">No failures recorded</p>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
