import { useMemo, type MouseEvent } from 'react';
import {
  eachDayOfInterval,
  format,
  formatISO,
  isSameMonth,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { CalendarCar, CalendarEvent } from './calendar.types';
import { eventChipClass, eventTypeLabel } from './eventStyles';

type BucketKey = 'reservation' | 'block' | 'task' | 'problem';

function bucketType(type: string): BucketKey {
  if (type === 'task') return 'task';
  if (type === 'blocked' || type === 'maintenance' || type === 'cleaning') return 'block';
  if (type === 'payment_issue' || type === 'manual_review') return 'problem';
  return 'reservation';
}

function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
  return events.filter((e) => {
    const s = parseISO(e.start).getTime();
    const en = parseISO(e.end).getTime();
    return s <= dayEnd && en >= dayStart;
  });
}

export function MonthFleetGrid({
  cars,
  events,
  from,
  to,
  onDayClick,
  onEventClick,
}: {
  cars: CalendarCar[];
  events: CalendarEvent[];
  from: Date;
  to: Date;
  onDayClick: (date: string, carId?: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const days = useMemo(
    () => eachDayOfInterval({ start: from, end: to }).filter((d) => isSameMonth(d, from)),
    [from, to]
  );

  function handleCellClick(day: Date, carId: string, dayEvents: CalendarEvent[]) {
    const dateStr = formatISO(day, { representation: 'date' });
    if (dayEvents.length === 1) {
      onEventClick(dayEvents[0]);
      return;
    }
    onDayClick(dateStr, carId);
  }

  function handleChipClick(
    e: MouseEvent,
    day: Date,
    carId: string,
    bucketEvents: CalendarEvent[]
  ) {
    e.stopPropagation();
    if (bucketEvents.length === 1) {
      onEventClick(bucketEvents[0]);
      return;
    }
    onDayClick(formatISO(day, { representation: 'date' }), carId);
  }

  return (
    <div
      className="overflow-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-soft)]"
      data-testid="month-fleet-grid"
    >
      <div className="min-w-[720px]">
        <div
          className="sticky top-0 z-30 grid border-b border-[var(--color-line)] bg-[var(--color-surface)]"
          style={{
            gridTemplateColumns: `160px repeat(${days.length}, minmax(36px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-40 border-r border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Car
          </div>
          {days.map((d) => (
            <button
              key={d.toISOString()}
              type="button"
              className="border-l border-[var(--color-line)]/60 px-0.5 py-2 text-center hover:bg-[var(--color-accent-muted)]/40"
              onClick={() => onDayClick(formatISO(d, { representation: 'date' }))}
            >
              <div className="text-[10px] font-semibold text-[var(--color-muted)]">
                {format(d, 'EEE')}
              </div>
              <div className="text-xs font-semibold text-[var(--color-ink)]">{format(d, 'd')}</div>
            </button>
          ))}
        </div>

        {cars.map((car) => (
          <div
            key={car.id}
            className="grid border-b border-[var(--color-line)] last:border-b-0"
            style={{
              gridTemplateColumns: `160px repeat(${days.length}, minmax(36px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-20 border-r border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3 py-2">
              <div className="truncate text-sm font-semibold text-[var(--color-ink)]">{car.name}</div>
              <div className="truncate text-[10px] text-[var(--color-muted)]">{car.status}</div>
            </div>
            {days.map((day) => {
              const dayEvents = eventsOnDay(
                events.filter((e) => e.carId === car.id),
                day
              );
              const buckets: Record<BucketKey, CalendarEvent[]> = {
                reservation: [],
                block: [],
                task: [],
                problem: [],
              };
              for (const ev of dayEvents) {
                buckets[bucketType(ev.type)].push(ev);
              }
              const chips = (Object.keys(buckets) as BucketKey[]).filter(
                (k) => buckets[k].length > 0
              );
              const visible = chips.slice(0, 2);
              const extra = chips.length - visible.length;

              return (
                <button
                  key={`${car.id}-${day.toISOString()}`}
                  type="button"
                  className="min-h-[52px] border-l border-[var(--color-line)]/50 p-0.5 text-left hover:bg-[var(--color-surface)]"
                  onClick={() => handleCellClick(day, car.id, dayEvents)}
                >
                  <div className="flex flex-col gap-0.5">
                    {visible.map((key) => {
                      const list = buckets[key];
                      const sample = list[0];
                      return (
                        <span
                          key={key}
                          role="presentation"
                          onClick={(e) => handleChipClick(e, day, car.id, list)}
                          title={`${eventTypeLabel(sample.type)} × ${list.length}`}
                          className={`truncate rounded border px-0.5 text-[9px] font-semibold leading-4 ${eventChipClass(sample.type)}`}
                        >
                          {list.length > 1 ? `${list.length}×` : ''}
                          {eventTypeLabel(sample.type).slice(0, 3)}
                        </span>
                      );
                    })}
                    {extra > 0 ? (
                      <span className="text-[9px] font-semibold text-[var(--color-muted)]">
                        +{extra}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ))}

        {cars.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--color-muted)]">No cars in this view</p>
        ) : null}
      </div>
    </div>
  );
}
