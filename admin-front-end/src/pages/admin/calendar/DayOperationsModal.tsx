/**
 * Modal summarizing a single days operational workload.
 */
import { useState, type ReactNode } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from 'date-fns'.
import { format, parseISO } from 'date-fns';
// Import named exports from '../../../api/admin/calendar'.
import { getCalendarDay } from '../../../api/admin/calendar';
// Import named exports from '../../../components/ui/Modal'.
import { Modal } from '../../../components/ui/Modal';
// Import named exports from '../../../components/ui/Loading'.
import { PageLoader } from '../../../components/ui/Loading';

// Declare the TabId TypeScript type alias.
type TabId = 'pickups' | 'returns' | 'fleet' | 'problems' | 'warnings';

/** Modal summarizing a single days operational workload. */
export function DayOperationsModal({
  // Contribute this line to the enclosing declaration or statement.
  date,
  // Contribute this line to the enclosing declaration or statement.
  open,
  // Contribute this line to the enclosing declaration or statement.
  onClose,
  // Contribute this line to the enclosing declaration or statement.
  onOpenEvent,
  // Contribute this line to the enclosing declaration or statement.
  onOpenReservation,
  // Contribute this line to the enclosing declaration or statement.
  onFreeCarAction,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the date field value.
  date: string | null;
  // Provide the open field value.
  open: boolean;
  // Provide the on close field value.
  onClose: () => void;
  // Continue the surrounding logic with this statement.
  onOpenEvent?: (eventId: string) => void;
  // Continue the surrounding logic with this statement.
  onOpenReservation?: (reservationId: string) => void;
  // Continue the surrounding logic with this statement.
  onFreeCarAction?: (carId: string) => void;
// Continue the surrounding logic with this statement.
}) {
  // Destructure array values into local variables.
  const [tab, setTab] = useState<TabId>('pickups');
  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'calendar', 'day', date],
    // Provide the query fn field value.
    queryFn: () => getCalendarDay(date!),
    // Provide the enabled field value.
    enabled: open && Boolean(date),
  });

  // Create the title date constant.
  const titleDate = date
    // Continue the surrounding logic with this statement.
    ? (() => {
        // Start a try block for operations that may fail.
        try {
          // Return the resulting value to the caller.
          return format(parseISO(date), 'EEE d MMM yyyy');
        // Contribute this line to the enclosing declaration or statement.
        } catch {
          // Return the resulting value to the caller.
          return date;
        }
      // Continue the surrounding logic with this statement.
      })()
    // Contribute this line to the enclosing declaration or statement.
    : 'Day ops';

  // Continue the surrounding logic with this statement.
  const tabs: { id: TabId; label: string; count: number }[] = data
    // Contribute this line to the enclosing declaration or statement.
    ? [
        // Contribute this line to the enclosing declaration or statement.
        { id: 'pickups', label: 'Pickups', count: data.pickups.length },
        // Contribute this line to the enclosing declaration or statement.
        { id: 'returns', label: 'Returns', count: data.returns.length },
        {
          // Provide the id field value.
          id: 'fleet',
          // Provide the label field value.
          label: 'Free/Busy',
          // Provide the count field value.
          count: data.freeCars.length + data.busyCars.length,
        },
        // Contribute this line to the enclosing declaration or statement.
        { id: 'problems', label: 'Problems', count: data.problems.length },
        {
          // Provide the id field value.
          id: 'warnings',
          // Provide the label field value.
          label: 'Warnings',
          // Provide the count field value.
          count: data.insuranceWarnings.length + data.paidNotConfirmed.length,
        },
      ]
    // Contribute this line to the enclosing declaration or statement.
    : [];

  // Return control to the caller with the following value.
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

/** Stat. */
function Stat({
  // Contribute this line to the enclosing declaration or statement.
  label,
  // Contribute this line to the enclosing declaration or statement.
  value,
  // Contribute this line to the enclosing declaration or statement.
  urgency,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the label field value.
  label: string;
  // Provide the value field value.
  value: number;
  // Contribute this line to the enclosing declaration or statement.
  urgency?: boolean;
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
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

/** List. */
function List({ children }: { children: ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

/** Sub. */
function Sub({ title, children }: { title: string; children: ReactNode }) {
  // Return control to the caller with the following value.
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

/** Empty. */
function Empty() {
  return <p className="py-4 text-center text-[var(--color-muted)]">Nothing here</p>;
}

/** Ops Row. */
function OpsRow({
  // Contribute this line to the enclosing declaration or statement.
  label,
  // Contribute this line to the enclosing declaration or statement.
  meta,
  // Contribute this line to the enclosing declaration or statement.
  onClick,
  // Contribute this line to the enclosing declaration or statement.
  onOpen,
  // Contribute this line to the enclosing declaration or statement.
  urgency,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the label field value.
  label: string;
  // Provide the meta field value.
  meta: string;
  // Continue the surrounding logic with this statement.
  onClick?: () => void;
  // Continue the surrounding logic with this statement.
  onOpen?: () => void;
  // Contribute this line to the enclosing declaration or statement.
  urgency?: boolean;
// Continue the surrounding logic with this statement.
}) {
  // Create the class name constant.
  const className = `flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
    // Reference the identifier used by the enclosing expression.
    urgency
      // Continue the surrounding logic with this statement.
      ? 'border-[var(--color-danger)]/25 bg-[var(--color-danger)]/5'
      // Continue the surrounding logic with this statement.
      : 'border-[var(--color-line)]'
  // Continue the surrounding logic with this statement.
  } ${onClick ? 'cursor-pointer hover:border-[var(--color-accent)]' : ''}`;

  // Return control to the caller with the following value.
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
