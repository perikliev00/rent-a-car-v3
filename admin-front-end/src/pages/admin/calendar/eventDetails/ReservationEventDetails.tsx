import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../../components/ui/Button';
import { opsReservationUrl } from '../reservationDeepLink';
import { Field, Section } from './EventDetailsPrimitives';
import { fmt } from './formatEventDate';

export function ReservationEventDetails({
  reservation,
  documents,
  auditHistory,
  actions,
  canOps,
  canChangeStatus,
  busy,
  onCreateTask,
  markStatus,
  copyPhone,
  cancelReservation,
}: {
  reservation: Record<string, unknown>;
  documents: Array<Record<string, unknown>>;
  auditHistory: Array<Record<string, unknown>>;
  actions?: Record<string, boolean>;
  canOps: boolean;
  canChangeStatus: boolean;
  busy: boolean;
  onCreateTask?: (carId: string | null) => void;
  markStatus: (next: 'picked_up' | 'returned') => void | Promise<void>;
  copyPhone: () => void | Promise<void>;
  cancelReservation: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const opsUrl = reservation?.id ? opsReservationUrl(String(reservation.id)) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col text-sm">
      <div className="flex-1 space-y-5">
        <Section title="Customer">
          <Field label="Name" value={String(reservation.fullName || '—')} />
          <Field label="Email" value={String(reservation.email || '—')} />
          {reservation.phoneNumber ? (
            <Field label="Phone" value={String(reservation.phoneNumber)} />
          ) : null}
        </Section>
        <Section title="Trip">
          <Field label="Pickup" value={fmt(String(reservation.pickupDate))} />
          <Field label="Return" value={fmt(String(reservation.returnDate))} />
          <Field label="Pickup location" value={String(reservation.pickupLocation || '—')} />
          <Field label="Return location" value={String(reservation.returnLocation || '—')} />
        </Section>
        {reservation.totalPrice != null ? (
          <Section title="Payment">
            <Field label="Total" value={String(reservation.totalPrice)} />
          </Section>
        ) : null}
        {documents.length > 0 ? (
          <Section title="Documents">
            <ul className="space-y-1">
              {documents.map((d) => (
                <li key={String(d.id)}>
                  {String(d.docType)} · {String(d.fileName)}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        {auditHistory.length > 0 ? (
          <Section title="Audit">
            <ul className="space-y-1">
              {auditHistory.map((a) => (
                <li key={String(a.id)} className="text-xs text-[var(--color-muted)]">
                  {String(a.action)} · {String(a.createdAt)}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        {actions?.canMove || actions?.canResize ? (
          <p className="text-xs text-[var(--color-muted)]">
            Drag the bar to move
            {actions?.canResize ? '; use edge handles to resize' : ''}.
          </p>
        ) : null}
      </div>
      <div className="sticky bottom-0 mt-4 flex flex-wrap gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface-elevated)] pt-4">
        {canOps && opsUrl ? (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => navigate(opsUrl)}
              data-testid="open-reservation-ops"
            >
              Open reservation
            </Button>
            <Link
              to={opsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] hover:border-[var(--color-accent)]"
            >
              Open in new tab
            </Link>
          </>
        ) : null}
        {actions?.canMarkPickup && canChangeStatus ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            data-testid="mark-pickup"
            onClick={() => void markStatus('picked_up')}
          >
            Mark pickup
          </Button>
        ) : null}
        {actions?.canMarkReturn && canChangeStatus ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            data-testid="mark-return"
            onClick={() => void markStatus('returned')}
          >
            Mark return
          </Button>
        ) : null}
        {onCreateTask ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onCreateTask(reservation.carId ? String(reservation.carId) : null)}
          >
            Create task
          </Button>
        ) : null}
        {reservation.phoneNumber ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void copyPhone()}>
            Copy phone
          </Button>
        ) : null}
        {actions?.canCancel ? (
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => void cancelReservation()}
            data-testid="cancel-reservation"
          >
            Cancel reservation
          </Button>
        ) : null}
      </div>
    </div>
  );
}
