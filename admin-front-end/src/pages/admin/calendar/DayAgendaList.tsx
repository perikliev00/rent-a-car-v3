import { format, parseISO } from 'date-fns';
import type { CalendarCar, CalendarEvent } from './calendar.types';
import { EVENT_TYPE_STYLE } from './eventStyles';

export function DayAgendaList({
  cars,
  events,
  day,
  onEventClick,
  onCarClick,
}: {
  cars: CalendarCar[];
  events: CalendarEvent[];
  day: Date;
  onEventClick: (event: CalendarEvent) => void;
  onCarClick?: (carId: string) => void;
}) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const dayEvents = events
    .filter((ev) => {
      const start = parseISO(ev.start).getTime();
      const end = parseISO(ev.end).getTime();
      return end > dayStart && start < dayEnd;
    })
    .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());

  const byCar = new Map<string, CalendarEvent[]>();
  for (const ev of dayEvents) {
    const key = ev.carId || '__none__';
    const list = byCar.get(key) || [];
    list.push(ev);
    byCar.set(key, list);
  }

  const orderedCars = [
    ...cars.filter((c) => byCar.has(c.id)),
    ...cars.filter((c) => !byCar.has(c.id)),
  ];

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
