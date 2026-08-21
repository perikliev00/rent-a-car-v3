import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ADMIN_OPS_STATUS_OPTIONS,
  REFUNDABLE_OPS_STATUSES,
  changeReservationStatus,
  getReservationChecklists,
  getReservationDetail,
  getReservationOpsDashboard,
  listCancellationRequests,
  refundReservation,
  reviewCancellationRequest,
  submitPickupChecklist,
  submitReturnChecklist,
  type OpsReservationRow,
  type ReservationOpsStatus,
  type ReservationStatusHistoryEntry,
} from '../../api/admin/reservations';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/permissions';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Loading';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { toast } from '../../components/ui/toastStore';

const WIDGET_META: { key: keyof ReturnType<typeof emptyWidgets>; title: string; hint: string }[] = [
  { key: 'todaysPickups', title: "Today's Pickups", hint: 'Confirmed / prepared for pickup today' },
  { key: 'todaysReturns', title: "Today's Returns", hint: 'Out on rental, due back today' },
  { key: 'activeRentals', title: 'Active Rentals', hint: 'Picked up or active rental' },
  { key: 'overdueReturns', title: 'Overdue Returns', hint: 'Past return time, not returned' },
  { key: 'manualReview', title: 'Manual Review', hint: 'Paid conflicts needing admin action' },
  { key: 'paidNotConfirmed', title: 'Paid — Not Confirmed', hint: 'Payment received, booking not confirmed' },
  { key: 'cancelled', title: 'Cancelled', hint: 'Recent cancellations' },
  { key: 'failedPayments', title: 'Failed / Expired Payments', hint: 'Holds and expired payment attempts' },
];

function emptyWidgets() {
  return {
    todaysPickups: [] as OpsReservationRow[],
    todaysReturns: [] as OpsReservationRow[],
    activeRentals: [] as OpsReservationRow[],
    overdueReturns: [] as OpsReservationRow[],
    manualReview: [] as OpsReservationRow[],
    paidNotConfirmed: [] as OpsReservationRow[],
    cancelled: [] as OpsReservationRow[],
    failedPayments: [] as OpsReservationRow[],
  };
}

function formatWhen(value?: string | null, time?: string | null) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    const datePart = d.toLocaleDateString();
    return time ? `${datePart} ${time}` : datePart;
  } catch {
    return value;
  }
}

function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusChipClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes('active') || s.includes('confirm') || s.includes('return') || s.includes('pickup')) {
    return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  }
  if (s.includes('paid') || s.includes('pending') || s.includes('hold') || s.includes('review')) {
    return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  }
  if (s.includes('cancel') || s.includes('fail') || s.includes('expir') || s.includes('overdue')) {
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

function formatChangedBy(entry: ReservationStatusHistoryEntry) {
  if (entry.changedBySystem) return 'System';
  if (entry.changedByEmail) return entry.changedByEmail;
  if (entry.changedByUserId != null) return `User #${entry.changedByUserId}`;
  return '—';
}

function StatusActions({
  row,
  onChanged,
}: {
  row: OpsReservationRow;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const canRefund = hasPermission(user, 'can_refund_payments');
  const showRefund =
    canRefund && REFUNDABLE_OPS_STATUSES.includes(row.status) && row.status !== 'refunded';

  const [status, setStatus] = useState<ReservationOpsStatus | ''>('');
  const mutation = useMutation({
    mutationFn: () =>
      changeReservationStatus(row.id, {
        status: status as ReservationOpsStatus,
        reason: 'admin_ops_dashboard',
      }),
    onSuccess: () => {
      toast('Status updated', 'success');
      setStatus('');
      onChanged();
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const refundMutation = useMutation({
    mutationFn: () =>
      refundReservation(row.id, { reason: 'admin_ops_dashboard_refund' }),
    onSuccess: (result) => {
      if (result.status === 'pending') {
        toast('Refund in progress — waiting for Stripe confirmation', 'info');
      } else {
        toast('Refund completed', 'success');
      }
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
          disabled={mutation.isPending || refundMutation.isPending}
          loading={refundMutation.isPending}
          onClick={() => refundMutation.mutate()}
        >
          Refund
        </Button>
      ) : null}
    </div>
  );
}

function StatusHistoryPanel({
  reservationId,
  onClose,
}: {
  reservationId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'reservations', reservationId, 'detail'],
    queryFn: () => getReservationDetail(reservationId),
  });

  const reservation = data?.reservation;
  const history = data?.history ?? [];
  const carLabel =
    reservation &&
    typeof reservation.carId === 'object' &&
    reservation.carId !== null &&
    'name' in reservation.carId
      ? String((reservation.carId as { name?: string }).name || '')
      : reservation?.carName
        ? String(reservation.carName)
        : '';

  return (
    <Card className="shadow-none">
      <CardBody className="px-5 py-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-[var(--color-ink)]">Status History</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Reservation #{reservationId}
              {carLabel ? ` · ${carLabel}` : ''}
              {reservation?.status ? ` · ${String(reservation.status)}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading history…</p>
        ) : isError ? (
          <p className="text-sm text-[var(--color-danger)]">
            {(error as Error).message || 'Failed to load history'}
          </p>
        ) : !history.length ? (
          <p className="text-sm text-[var(--color-muted)]">No status changes recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                  <th className="pb-2 pr-3 font-medium">When</th>
                  <th className="pb-2 pr-3 font-medium">Old status</th>
                  <th className="pb-2 pr-3 font-medium">New status</th>
                  <th className="pb-2 pr-3 font-medium">Changed by</th>
                  <th className="pb-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-b border-[var(--color-line)]/60 last:border-0">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-[var(--color-muted)]">
                      {formatTimestamp(entry.createdAt)}
                    </td>
                    <td className="py-1.5 pr-3">
                      {entry.oldStatus ? (
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 font-medium ${statusChipClass(entry.oldStatus)}`}
                        >
                          {entry.oldStatus}
                        </span>
                      ) : (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-medium ${statusChipClass(entry.newStatus)}`}
                      >
                        {entry.newStatus}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-[var(--color-ink)]">{formatChangedBy(entry)}</td>
                    <td className="py-1.5 text-[var(--color-muted)]">{entry.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

const FUEL_OPTIONS = [
  { value: 'empty', label: 'Empty' },
  { value: 'quarter', label: '1/4' },
  { value: 'half', label: '1/2' },
  { value: 'three_quarters', label: '3/4' },
  { value: 'full', label: 'Full' },
];

function ChecklistPanel({
  reservationId,
  onChanged,
}: {
  reservationId: string;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const checklistsQuery = useQuery({
    queryKey: ['admin', 'reservations', reservationId, 'checklists'],
    queryFn: () => getReservationChecklists(reservationId),
  });

  const [fuelLevel, setFuelLevel] = useState('full');
  const [mileage, setMileage] = useState('');
  const [damages, setDamages] = useState('');
  const [notes, setNotes] = useState('');
  const [extraFees, setExtraFees] = useState('0');
  const [lateReturn, setLateReturn] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [customerSignature, setCustomerSignature] = useState<File | null>(null);
  const [employeeSignature, setEmployeeSignature] = useState<File | null>(null);

  const pickupMutation = useMutation({
    mutationFn: () =>
      submitPickupChecklist(reservationId, {
        fuelLevel,
        mileage: Number(mileage),
        existingDamages: damages,
        notes,
        photos,
        customerSignature,
        employeeSignature,
      }),
    onSuccess: () => {
      toast('Pickup checklist saved', 'success');
      queryClient.invalidateQueries({
        queryKey: ['admin', 'reservations', reservationId, 'checklists'],
      });
      onChanged();
    },
    onError: (err) => toast((err as Error).message || 'Pickup checklist failed', 'error'),
  });

  const returnMutation = useMutation({
    mutationFn: () =>
      submitReturnChecklist(reservationId, {
        fuelLevel,
        mileage: Number(mileage),
        newDamages: damages,
        notes,
        lateReturn,
        extraFees: Number(extraFees) || 0,
        photos,
        customerSignature,
        employeeSignature,
      }),
    onSuccess: () => {
      toast('Return checklist saved', 'success');
      queryClient.invalidateQueries({
        queryKey: ['admin', 'reservations', reservationId, 'checklists'],
      });
      onChanged();
    },
    onError: (err) => toast((err as Error).message || 'Return checklist failed', 'error'),
  });

  return (
    <Card className="mt-4 shadow-none">
      <CardBody className="space-y-4 px-5 py-4">
        <h3 className="font-display font-semibold text-[var(--color-ink)]">
          Pickup / return checklist · #{reservationId}
        </h3>
        {checklistsQuery.data?.pickupChecklist ? (
          <p className="text-xs text-[var(--color-success)]">Pickup checklist on file</p>
        ) : null}
        {checklistsQuery.data?.returnChecklist ? (
          <p className="text-xs text-[var(--color-success)]">Return checklist on file</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Fuel level"
            value={fuelLevel}
            onChange={(e) => setFuelLevel(e.target.value)}
            options={FUEL_OPTIONS}
          />
          <Input
            label="Mileage"
            type="number"
            min={0}
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
        </div>
        <Textarea
          label="Damages / notes description"
          value={damages}
          onChange={(e) => setDamages(e.target.value)}
        />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Input
          label="Extra fees (return)"
          type="number"
          min={0}
          step="0.01"
          value={extraFees}
          onChange={(e) => setExtraFees(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
          <input
            type="checkbox"
            checked={lateReturn}
            onChange={(e) => setLateReturn(e.target.checked)}
          />
          Late return
        </label>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
            Photos (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files || []).slice(0, 5))}
            className="block w-full text-sm"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Customer signature
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCustomerSignature(e.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              Employee signature
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEmployeeSignature(e.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={pickupMutation.isPending}
            disabled={!mileage}
            onClick={() => pickupMutation.mutate()}
          >
            Save pickup checklist
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={returnMutation.isPending}
            disabled={!mileage}
            onClick={() => returnMutation.mutate()}
          >
            Save return checklist
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function CancellationRequestsPanel({ onChanged }: { onChanged: () => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'cancellation-requests'],
    queryFn: listCancellationRequests,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) =>
      reviewCancellationRequest(id, { approve }),
    onSuccess: () => {
      toast('Cancellation request updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'cancellation-requests'] });
      onChanged();
    },
    onError: (err) => toast((err as Error).message || 'Review failed', 'error'),
  });

  const requests = query.data?.requests ?? [];
  if (query.isLoading) return null;

  return (
    <Card className="mt-6 shadow-none">
      <CardBody className="px-5 py-4">
        <h2 className="font-display font-semibold text-[var(--color-ink)]">
          Cancellation requests
        </h2>
        <p className="text-sm text-[var(--color-muted)]">Pending customer cancellation requests</p>
        {!requests.length ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No pending requests</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {requests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)]/60 pb-3 last:border-0"
              >
                <div className="text-sm">
                  <p className="font-medium text-[var(--color-ink)]">
                    Reservation #{req.reservationId} · {req.customerName || req.customerEmail}
                  </p>
                  <p className="text-[var(--color-muted)]">{req.reason || 'No reason provided'}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ id: req.id, approve: true })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ id: req.id, approve: false })}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function OpsTable({
  rows,
  onChanged,
  selectedId,
  onSelect,
  showCancelReason = false,
}: {
  rows: OpsReservationRow[];
  onChanged: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showCancelReason?: boolean;
}) {
  if (!rows.length) {
    return <p className="text-sm text-[var(--color-muted)]">No items</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
            <th className="pb-2 pr-3 font-medium">ID</th>
            <th className="pb-2 pr-3 font-medium">Car</th>
            <th className="pb-2 pr-3 font-medium">Renter</th>
            <th className="pb-2 pr-3 font-medium">Pickup</th>
            <th className="pb-2 pr-3 font-medium">Return</th>
            <th className="pb-2 pr-3 font-medium">Status</th>
            {showCancelReason ? <th className="pb-2 pr-3 font-medium">Reason</th> : null}
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedId === row.id;
            return (
              <tr
                key={row.id}
                className={`border-b border-[var(--color-line)]/60 last:border-0 ${
                  selected ? 'bg-[var(--color-accent-muted)]/40' : ''
                }`}
              >
                <td className="py-1.5 pr-3 font-mono">
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    className={`underline-offset-2 hover:underline ${
                      selected
                        ? 'font-semibold text-[var(--color-ink)]'
                        : 'text-[var(--color-muted)]'
                    }`}
                    title="View status history"
                  >
                    {row.id}
                  </button>
                </td>
                <td className="py-1.5 pr-3 text-[var(--color-ink)]">{row.carName || '—'}</td>
                <td className="py-1.5 pr-3">
                  <div className="text-[var(--color-ink)]">{row.fullName || '—'}</div>
                  <div className="text-[var(--color-muted)]">{row.email || ''}</div>
                </td>
                <td className="py-1.5 pr-3 text-[var(--color-ink)]">
                  {formatWhen(row.pickupDate, row.pickupTime)}
                </td>
                <td className="py-1.5 pr-3 text-[var(--color-ink)]">
                  {formatWhen(row.returnDate, row.returnTime)}
                </td>
                <td className="py-1.5 pr-3">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 font-medium ${statusChipClass(row.status)}`}
                  >
                    {row.status}
                  </span>
                </td>
                {showCancelReason ? (
                  <td className="py-1.5 pr-3 text-[var(--color-muted)]">{row.cancelReason || '—'}</td>
                ) : null}
                <td className="py-1.5">
                  <StatusActions row={row} onChanged={onChanged} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdminReservationOpsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'reservations', 'ops-dashboard'],
    queryFn: () => getReservationOpsDashboard(20),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'reservations', 'ops-dashboard'] });
    if (selectedId) {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'reservations', selectedId, 'detail'],
      });
    }
  };

  function setSelectedId(id: string | null) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('id', id);
    else next.delete('id');
    setSearchParams(next, { replace: true });
  }

  const toggleSelect = (id: string) => {
    setSelectedId(selectedId === id ? null : id);
  };

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Reservation Ops
        </h1>
        <p className="mt-2 text-[var(--color-danger)]">
          {(error as Error).message || 'Error loading ops dashboard'}
        </p>
      </div>
    );
  }

  const widgets = data?.widgets ?? emptyWidgets();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Reservation Ops
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">
            Pickup, return, and payment lifecycle · Sofia day {data?.today}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {selectedId ? (
        <div className="mt-6">
          <StatusHistoryPanel reservationId={selectedId} onClose={() => setSelectedId(null)} />
          <ChecklistPanel reservationId={selectedId} onChanged={refresh} />
        </div>
      ) : null}

      <CancellationRequestsPanel onChanged={refresh} />

      <div className="mt-8 space-y-4">
        {WIDGET_META.map((widget) => (
          <Card key={widget.key} className="shadow-none">
            <CardBody className="px-5 py-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display font-semibold text-[var(--color-ink)]">
                    {widget.title}
                  </h2>
                  <p className="text-sm text-[var(--color-muted)]">{widget.hint}</p>
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  {widgets[widget.key].length} shown
                </p>
              </div>
              <OpsTable
                rows={widgets[widget.key]}
                onChanged={refresh}
                selectedId={selectedId}
                onSelect={toggleSelect}
                showCancelReason={widget.key === 'cancelled'}
              />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
