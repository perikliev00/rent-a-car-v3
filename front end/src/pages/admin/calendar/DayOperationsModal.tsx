import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { getCalendarDay } from '../../../api/admin/calendar';
import { Modal } from '../../../components/ui/Modal';
import { PageLoader } from '../../../components/ui/Loading';

type TabId = 'pickups' | 'returns' | 'fleet' | 'problems' | 'warnings';

export function DayOperationsModal({
  date,
  open,
  onClose,
  onOpenEvent,
  onOpenReservation,
  onFreeCarAction,
}: {
  date: string | null;
  open: boolean;
  onClose: () => void;
  onOpenEvent?: (eventId: string) => void;
  onOpenReservation?: (reservationId: string) => void;
  onFreeCarAction?: (carId: string) => void;
}) {
  const [tab, setTab] = useState<TabId>('pickups');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'calendar', 'day', date],
    queryFn: () => getCalendarDay(date!),
    enabled: open && Boolean(date),
  });

  const titleDate = date
    ? (() => {
        try {
          return format(parseISO(date), 'EEE d MMM yyyy');
        } catch {
          return date;
        }
      })()
    : 'Day ops';

  const tabs: { id: TabId; label: string; count: number }[] = data
    ? [
        { id: 'pickups', label: 'Pickups', count: data.pickups.length },
        { id: 'returns', label: 'Returns', count: data.returns.length },
        {
          id: 'fleet',
          label: 'Free/Busy',
          count: data.freeCars.length + data.busyCars.length,
        },
        { id: 'problems', label: 'Problems', count: data.problems.length },
        {
          id: 'warnings',
          label: 'Warnings',
          count: data.insuranceWarnings.length + data.paidNotConfirmed.length,
        },
      ]
    : [];

  return (
    <Modal open={open} onClose={onClose} title={`Day ops · ${titleDate}`} wide>
      <div className="animate-lux-fade">
        {isLoading ? <PageLoader /> : null}
        {data ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Pickups" value={data.pickups.length} />
              <Stat label="Returns" value={data.returns.length} />
              <Stat label="Free cars" value={data.freeCars.length} />
              <Stat label="Problems" value={data.problems.length} urgency={data.problems.length > 0} />
            </div>

            <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    tab === t.id
                      ? 'bg-[var(--color-ink)] text-white'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            {tab === 'pickups' ? (
              <List>
                {data.pickups.map((p) => (
                  <OpsRow
                    key={String(p.id)}
                    label={`${p.carName} · ${p.fullName}`}
                    meta={`${p.status}${p.phoneNumber ? ` · ${p.phoneNumber}` : ''}`}
                    onClick={() => onOpenEvent?.(`reservation:${p.id}`)}
                    onOpen={
                      onOpenReservation
                        ? () => onOpenReservation(String(p.id))
                        : undefined
                    }
                  />
                ))}
                {data.pickups.length === 0 ? <Empty /> : null}
              </List>
            ) : null}

            {tab === 'returns' ? (
              <List>
                {data.returns.map((p) => (
                  <OpsRow
                    key={String(p.id)}
                    label={`${p.carName} · ${p.fullName}`}
                    meta={`${p.status}${p.phoneNumber ? ` · ${p.phoneNumber}` : ''}`}
                    onClick={() => onOpenEvent?.(`reservation:${p.id}`)}
                    onOpen={
                      onOpenReservation
                        ? () => onOpenReservation(String(p.id))
                        : undefined
                    }
                  />
                ))}
                {data.returns.length === 0 ? <Empty /> : null}
              </List>
            ) : null}

            {tab === 'fleet' ? (
              <div className="space-y-4">
                <Sub title={`Free (${data.freeCars.length})`}>
                  {data.freeCars.map((c) => (
                    <OpsRow
                      key={c.id}
                      label={c.name}
                      meta={c.status}
                      onClick={onFreeCarAction ? () => onFreeCarAction(c.id) : undefined}
                    />
                  ))}
                </Sub>
                <Sub title={`Busy (${data.busyCars.length})`}>
                  {data.busyCars.map((c) => (
                    <OpsRow key={c.id} label={c.name} meta={c.status} />
                  ))}
                </Sub>
              </div>
            ) : null}

            {tab === 'problems' ? (
              <List>
                {data.problems.map((p, i) => (
                  <OpsRow
                    key={`${p.type}-${i}`}
                    label={p.label}
                    meta={p.type}
                    urgency
                    onClick={
                      p.reservationId
                        ? () => onOpenEvent?.(`reservation:${p.reservationId}`)
                        : undefined
                    }
                  />
                ))}
                {data.problems.length === 0 ? <Empty /> : null}
              </List>
            ) : null}

            {tab === 'warnings' ? (
              <div className="space-y-4">
                <Sub title={`Paid not confirmed (${data.paidNotConfirmed.length})`}>
                  {data.paidNotConfirmed.map((p) => (
                    <OpsRow
                      key={String(p.id)}
                      label={String(p.fullName || p.id)}
                      meta={String(p.status)}
                      urgency
                      onClick={() => onOpenEvent?.(`reservation:${p.id}`)}
                    />
                  ))}
                </Sub>
                <Sub title={`Insurance / inspection (${data.insuranceWarnings.length})`}>
                  {data.insuranceWarnings.map((c) => (
                    <OpsRow
                      key={String(c.id)}
                      label={String(c.name)}
                      meta={`ins ${c.insuranceExpiry || '—'} · tech ${c.technicalInspectionExpiry || '—'}`}
                      urgency
                    />
                  ))}
                </Sub>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function Stat({
  label,
  value,
  urgency,
}: {
  label: string;
  value: number;
  urgency?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        urgency
          ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10'
          : 'border-[var(--color-line)] bg-[var(--color-surface)]'
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </div>
      <div className="font-display text-xl font-bold text-[var(--color-ink)]">{value}</div>
    </div>
  );
}

function List({ children }: { children: ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="py-4 text-center text-[var(--color-muted)]">Nothing here</p>;
}

function OpsRow({
  label,
  meta,
  onClick,
  onOpen,
  urgency,
}: {
  label: string;
  meta: string;
  onClick?: () => void;
  onOpen?: () => void;
  urgency?: boolean;
}) {
  const className = `flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
    urgency
      ? 'border-[var(--color-danger)]/25 bg-[var(--color-danger)]/5'
      : 'border-[var(--color-line)]'
  } ${onClick ? 'cursor-pointer hover:border-[var(--color-accent)]' : ''}`;

  return (
    <div className={className}>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onClick}
        disabled={!onClick}
      >
        <span className="block text-[var(--color-ink)]">{label}</span>
        <span className="block text-xs text-[var(--color-muted)]">{meta}</span>
      </button>
      {onOpen ? (
        <button
          type="button"
          className="shrink-0 rounded-lg border border-[var(--color-line)] px-2 py-1 text-[11px] font-semibold text-[var(--color-ink)] hover:border-[var(--color-accent)]"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Open
        </button>
      ) : null}
    </div>
  );
}
