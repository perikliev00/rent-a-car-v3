/**
 * Month grid overview of fleet occupancy density.
 */
import { useMemo, type MouseEvent } from 'react';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  eachDayOfInterval,
  // Contribute this line to the enclosing declaration or statement.
  format,
  // Contribute this line to the enclosing declaration or statement.
  formatISO,
  // Contribute this line to the enclosing declaration or statement.
  isSameMonth,
  // Contribute this line to the enclosing declaration or statement.
  parseISO,
  // Contribute this line to the enclosing declaration or statement.
  startOfDay,
// Contribute this line to the enclosing declaration or statement.
} from 'date-fns';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarCar, CalendarEvent } from './calendar.types';
// Import named exports from './eventStyles'.
import { eventChipClass, eventTypeLabel } from './eventStyles';

// Declare the BucketKey TypeScript type alias.
type BucketKey = 'reservation' | 'block' | 'task' | 'problem';

/** Bucket Type. */
function bucketType(type: string): BucketKey {
  // Evaluate the condition and enter the branch when it is true.
  if (type === 'task') return 'task';
  // Evaluate the condition and enter the branch when it is true.
  if (type === 'blocked' || type === 'maintenance' || type === 'cleaning') return 'block';
  // Evaluate the condition and enter the branch when it is true.
  if (type === 'payment_issue' || type === 'manual_review') return 'problem';
  // Return the resulting value to the caller.
  return 'reservation';
}

/** Events On Day. */
function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  // Create the day start constant.
  const dayStart = startOfDay(day).getTime();
  // Create the day end constant.
  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
  // Return the resulting value to the caller.
  return events.filter((e) => {
    // Create the s constant.
    const s = parseISO(e.start).getTime();
    // Create the en constant.
    const en = parseISO(e.end).getTime();
    // Return the resulting value to the caller.
    return s <= dayEnd && en >= dayStart;
  });
}

/** Month grid overview of fleet occupancy density. */
export function MonthFleetGrid({
  // Contribute this line to the enclosing declaration or statement.
  cars,
  // Contribute this line to the enclosing declaration or statement.
  events,
  // Contribute this line to the enclosing declaration or statement.
  from,
  // Contribute this line to the enclosing declaration or statement.
  to,
  // Contribute this line to the enclosing declaration or statement.
  onDayClick,
  // Contribute this line to the enclosing declaration or statement.
  onEventClick,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the cars field value.
  cars: CalendarCar[];
  // Provide the events field value.
  events: CalendarEvent[];
  // Provide the from field value.
  from: Date;
  // Provide the to field value.
  to: Date;
  // Provide the on day click field value.
  onDayClick: (date: string, carId?: string) => void;
  // Provide the on event click field value.
  onEventClick: (event: CalendarEvent) => void;
// Continue the surrounding logic with this statement.
}) {
  // Create the days constant.
  const days = useMemo(
    // Continue the surrounding logic with this statement.
    () => eachDayOfInterval({ start: from, end: to }).filter((d) => isSameMonth(d, from)),
    // Contribute this line to the enclosing declaration or statement.
    [from, to]
  );

  /** Handle Cell Click. */
  function handleCellClick(day: Date, carId: string, dayEvents: CalendarEvent[]) {
    // Create the date str constant.
    const dateStr = formatISO(day, { representation: 'date' });
    // Evaluate the condition and enter the branch when it is true.
    if (dayEvents.length === 1) {
      // Call onEventClick to perform this step.
      onEventClick(dayEvents[0]);
      // Return control to the caller with the following value.
      return;
    }
    // Call onDayClick to perform this step.
    onDayClick(dateStr, carId);
  }

  /** Handle Chip Click. */
  function handleChipClick(
    // Provide the e field value.
    e: MouseEvent,
    // Provide the day field value.
    day: Date,
    // Provide the car id field value.
    carId: string,
    // Provide the bucket events field value.
    bucketEvents: CalendarEvent[]
  // Continue the surrounding logic with this statement.
  ) {
    // Call e.stopPropagation to perform this step.
    e.stopPropagation();
    // Evaluate the condition and enter the branch when it is true.
    if (bucketEvents.length === 1) {
      // Call onEventClick to perform this step.
      onEventClick(bucketEvents[0]);
      // Return control to the caller with the following value.
      return;
    }
    // Call onDayClick to perform this step.
    onDayClick(formatISO(day, { representation: 'date' }), carId);
  }

  // Return control to the caller with the following value.
  return (
    <div
      className="max-w-full min-w-0 overflow-x-auto overflow-y-auto overscroll-x-contain rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-soft)]"
      data-testid="month-fleet-grid"
    >
      <div className="min-w-[560px] sm:min-w-[720px]">
        <div
          className="sticky top-0 z-30 grid border-b border-[var(--color-line)] bg-[var(--color-surface)]"
          style={{
            gridTemplateColumns: `minmax(72px, 160px) repeat(${days.length}, minmax(36px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-40 border-r border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] sm:px-3">
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
              gridTemplateColumns: `minmax(72px, 160px) repeat(${days.length}, minmax(36px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-20 min-w-0 border-r border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-2 py-2 sm:px-3">
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
