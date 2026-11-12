/**
 * Day-density agenda list of pickups/returns/tasks.
 */
import { format, parseISO } from 'date-fns';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarCar, CalendarEvent } from './calendar.types';
// Import named exports from './eventStyles'.
import { EVENT_TYPE_STYLE } from './eventStyles';

/**
 * Day-density agenda: events overlapping `day`, grouped by car.
 *
 * @param cars - Fleet cars for labels/order
 * @param events - All loaded calendar events
 * @param day - Calendar day to list
 * @param onEventClick - Open event details
 * @param onCarClick - Optional car-row action
 */
export function DayAgendaList({
  // Contribute this line to the enclosing declaration or statement.
  cars,
  // Contribute this line to the enclosing declaration or statement.
  events,
  // Contribute this line to the enclosing declaration or statement.
  day,
  // Contribute this line to the enclosing declaration or statement.
  onEventClick,
  // Contribute this line to the enclosing declaration or statement.
  onCarClick,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the cars field value.
  cars: CalendarCar[];
  // Provide the events field value.
  events: CalendarEvent[];
  // Provide the day field value.
  day: Date;
  // Provide the on event click field value.
  onEventClick: (event: CalendarEvent) => void;
  // Continue the surrounding logic with this statement.
  onCarClick?: (carId: string) => void;
// Continue the surrounding logic with this statement.
}) {
  // Local midnight window for the selected day.
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  // Create the day end constant.
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  // Overlap test (not “starts on day”) so multi-day bars still appear.
  const dayEvents = events
    // Call .filter to perform this step.
    .filter((ev) => {
      // Create the start constant.
      const start = parseISO(ev.start).getTime();
      // Create the end constant.
      const end = parseISO(ev.end).getTime();
      // Return the resulting value to the caller.
      return end > dayStart && start < dayEnd;
    })
    // Call .sort to perform this step.
    .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());

  // Group by car; events without a car go under `__none__`.
  const byCar = new Map<string, CalendarEvent[]>();
  // Iterate using the loop initializer, condition, and step.
  for (const ev of dayEvents) {
    // Create the key constant.
    const key = ev.carId || '__none__';
    // Create the list constant.
    const list = byCar.get(key) || [];
    // Call list.push to perform this step.
    list.push(ev);
    // Call byCar.set to perform this step.
    byCar.set(key, list);
  }

  // Cars with events first (fleet order), then orphan `__none__` if needed.
  const orderedCars = [
    // Call ...cars.filter to perform this step.
    ...cars.filter((c) => byCar.has(c.id)),
    // Call ...cars.filter to perform this step.
    ...cars.filter((c) => !byCar.has(c.id)),
  ];

  // Return control to the caller with the following value.
  return (
    <div
      className="space-y-3"
      data-testid="calendar-day-agenda"
      aria-label={`Agenda for ${format(day, 'd MMM yyyy')}`}
    >
      <p className="text-sm text-[var(--color-muted)]">
        {dayEvents.length} event{dayEvents.length === 1 ? '' : 's'} · tap a row for details or edit
        via the form
      </p>

      {orderedCars.map((car) => {
        const rows = byCar.get(car.id) || [];
        return (
          <section
            key={car.id}
            className="min-w-0 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)]"
          >
            <button
              type="button"
              className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 border-b border-[var(--color-line)] px-4 py-3 text-left"
              onClick={() => onCarClick?.(car.id)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--color-ink)]">
                  {car.name}
                </span>
                <span className="block truncate text-[11px] text-[var(--color-muted)]">
                  {car.status}
                  {car.currentLocation ? ` · ${car.currentLocation}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                {rows.length || 'Free'}
              </span>
            </button>
            {rows.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[var(--color-muted)]">No events</p>
            ) : (
              <ul className="divide-y divide-[var(--color-line)]">
                {rows.map((ev) => {
                  const style = EVENT_TYPE_STYLE[ev.type as keyof typeof EVENT_TYPE_STYLE];
                  return (
                    <li key={ev.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full min-w-0 items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface)]"
                        onClick={() => onEventClick(ev)}
                        data-testid={`agenda-event-${ev.id}`}
                      >
                        <span
                          className={`mt-1 inline-block h-3 w-1.5 shrink-0 rounded-sm border-l-2 ${style?.bar || 'border-[var(--color-muted)]'}`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--color-ink)]">
                            {ev.title}
                          </span>
                          <span className="block text-[11px] text-[var(--color-muted)]">
                            {format(parseISO(ev.start), 'HH:mm')} – {format(parseISO(ev.end), 'HH:mm')}
                            {style?.label ? ` · ${style.label}` : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {cars.length === 0 ? (
        <p className="rounded-2xl border border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-muted)]">
          No cars in this view
        </p>
      ) : null}
    </div>
  );
}
