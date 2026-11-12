/**
 * Payment events/failures monitor, reconcile, and refund queue.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getPaymentRefundQueue,
  // Contribute this line to the enclosing declaration or statement.
  getPayments,
  // Contribute this line to the enclosing declaration or statement.
  reconcilePayments,
  // Declare the PaymentRefundQueueFilters TypeScript type alias.
  type PaymentRefundQueueFilters,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/admin/payments';
// Import named exports from '../../api/admin/reservations'.
import { refundReservation, type OpsReservationRow } from '../../api/admin/reservations';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Input'.
import { Input } from '../../components/ui/Input';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/Select'.
import { Select } from '../../components/ui/Select';
// Import named exports from '../../components/ui/toastStore'.
import { toast } from '../../components/ui/toastStore';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../auth/permissions'.
import { hasPermission } from '../../auth/permissions';
// Import named exports from './refund/RefundConfirmModal'.
import { RefundConfirmModal } from './refund/RefundConfirmModal';
// Import named exports from './refund/RefundLedgerBadge'.
import { RefundLedgerBadge } from './refund/RefundLedgerBadge';
// Import named exports from './refund/refundFormat'.
import { formatRefundMoney } from './refund/refundFormat';

// Create the status options constant.
const STATUS_OPTIONS = [
  // Contribute this line to the enclosing declaration or statement.
  { value: '', label: 'All refundable' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'paid', label: 'paid' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'confirmed', label: 'confirmed' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'car_prepared', label: 'car_prepared' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'manual_review', label: 'manual_review' },
];

// Create the refund state options constant.
const REFUND_STATE_OPTIONS = [
  // Contribute this line to the enclosing declaration or statement.
  { value: '', label: 'Any ledger' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'none', label: 'none' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'pending', label: 'pending' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'failed', label: 'failed' },
];

/** Format When. */
function formatWhen(value?: string | null) {
  // Evaluate the condition and enter the branch when it is true.
  if (!value) return '—';
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return new Date(value).toLocaleString();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return String(value);
  }
}

/** Empty Filters. */
function emptyFilters(): PaymentRefundQueueFilters {
  // Return the resulting value to the caller.
  return { q: '', status: '', refundState: '', pickupFrom: '', pickupTo: '' };
}

/** Refund Queue Actions. */
function RefundQueueActions({
  // Contribute this line to the enclosing declaration or statement.
  row,
  // Contribute this line to the enclosing declaration or statement.
  onChanged,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the row field value.
  row: OpsReservationRow;
  // Provide the on changed field value.
  onChanged: () => void;
// Continue the surrounding logic with this statement.
}) {
  // Create the ledger status constant.
  const ledgerStatus = row.refundOperation?.status;
  // Create the refund pending constant.
  const refundPending = ledgerStatus === 'pending';
  // Destructure array values into local variables.
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  // Return control to the caller with the following value.
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

/** Refundable Table. */
function RefundableTable({
  // Contribute this line to the enclosing declaration or statement.
  rows,
  // Contribute this line to the enclosing declaration or statement.
  onChanged,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the rows field value.
  rows: OpsReservationRow[];
  // Provide the on changed field value.
  onChanged: () => void;
// Continue the surrounding logic with this statement.
}) {
  // Evaluate the condition and enter the branch when it is true.
  if (!rows.length) {
    return <p className="text-sm text-[var(--color-muted)]">No refundable bookings</p>;
  }

  // Return control to the caller with the following value.
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

/** Recent Refunds Table. */
function RecentRefundsTable({ rows }: { rows: OpsReservationRow[] }) {
  // Evaluate the condition and enter the branch when it is true.
  if (!rows.length) {
    return <p className="mt-4 text-sm text-[var(--color-muted)]">No recent refunds</p>;
  }

  // Return control to the caller with the following value.
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

/** Payment events/failures monitor, reconcile, and refund queue. */
export function AdminPaymentsPage() {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Create the can refund constant.
  const canRefund = hasPermission(user, 'can_refund_payments');
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [dryRun, setDryRun] = useState(true);
  // Destructure array values into local variables.
  const [draft, setDraft] = useState<PaymentRefundQueueFilters>(emptyFilters);
  // Destructure array values into local variables.
  const [filters, setFilters] = useState<PaymentRefundQueueFilters>(emptyFilters);

  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'payments'], queryFn: getPayments });

  // Create the queue query constant.
  const queueQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'payments', 'refund-queue', filters],
    // Provide the query fn field value.
    queryFn: () => getPaymentRefundQueue(filters),
    // Provide the enabled field value.
    enabled: canRefund,
  });

  // Create the reconcile mutation constant.
  const reconcileMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: () => reconcilePayments(dryRun),
    // Provide the on success field value.
    onSuccess: (result) => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
      // Call toast to perform this step.
      toast(`Reconcile ${result.dryRun ? '(dry run) ' : ''}completed`, 'success');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the refresh queue constant.
  const refreshQueue = () => {
    // Call queryClient.invalidateQueries to perform this step.
    queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
    // Call queryClient.invalidateQueries to perform this step.
    queryClient.invalidateQueries({ queryKey: ['admin', 'reservations'] });
  };

  // Create the apply filters constant.
  const applyFilters = () => {
    // Call setFilters to perform this step.
    setFilters({
      // Provide the q field value.
      q: String(draft.q || '').trim(),
      // Provide the status field value.
      status: draft.status || '',
      // Provide the refund state field value.
      refundState: draft.refundState || '',
      // Provide the pickup from field value.
      pickupFrom: draft.pickupFrom || '',
      // Provide the pickup to field value.
      pickupTo: draft.pickupTo || '',
    });
  };

  if (isLoading) return <PageLoader />;

  // Return control to the caller with the following value.
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
