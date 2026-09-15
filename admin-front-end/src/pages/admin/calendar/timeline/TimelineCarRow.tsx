import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CalendarCar, CalendarEvent } from '../calendar.types';
import { TimelineEventBar } from './TimelineEventBar';
import {
  assignLanes,
  atFromClientX,
  leftPct,
  trackHeight,
  type TimelineGhost,
} from './timelineLayout';

export function TimelineCarRow({
  car,
  events,
  from,
  rangeMs,
  totalMinutes,
  isDayView,
  hours,
  dayStarts,
  nowPct,
  ghost,
  isTarget,
  moving,
  canDragReservations,
  canDragTasks,
  canResize,
  selectedEventId,
  carCol,
  onEventClick,
  onEmptySlot,
  onCarLabelClick,
  onReservationOpen,
  beginResize,
  beginPointerMove,
  onTrackDragOver,
  onTrackDragLeave,
  onTrackDrop,
}: {
  car: CalendarCar;
  events: CalendarEvent[];
  from: Date;
  rangeMs: number;
  totalMinutes: number;
  isDayView: boolean;
  hours: Date[];
  dayStarts: Date[];
  nowPct: number | null;
  ghost: TimelineGhost | null;
  isTarget: boolean;
  moving: boolean;
  canDragReservations: boolean;
  canDragTasks: boolean;
  canResize: boolean;
  selectedEventId?: string | null;
  carCol: number;
  onEventClick: (event: CalendarEvent) => void;
  onEmptySlot: (payload: { carId: string; at: Date; clientX: number; clientY: number }) => void;
  onCarLabelClick?: (carId: string) => void;
  onReservationOpen?: (reservationId: string) => void;
  beginResize: (
    e: ReactPointerEvent,
    ev: CalendarEvent,
    edge: 'start' | 'end',
    trackEl: HTMLElement | null
  ) => void;
  beginPointerMove: (
    e: ReactPointerEvent,
    ev: CalendarEvent,
    trackEl: HTMLElement | null
  ) => void;
  onTrackDragOver: (e: React.DragEvent<HTMLElement>, carId: string) => void;
  onTrackDragLeave: (carId: string) => void;
  onTrackDrop: (e: React.DragEvent<HTMLElement>, carId: string) => void;
}) {
  const rowEvents = events.filter((e) => e.carId === car.id);
  const lanes = assignLanes(rowEvents);
  const maxLane = rowEvents.reduce((m, e) => Math.max(m, lanes.get(e.id) ?? 0), 0);
  const trackH = trackHeight(maxLane);

  return (
    <div
      className={`grid border-b border-[var(--color-line)] last:border-b-0 ${
        isTarget ? 'bg-[var(--color-accent-muted)]/40' : ''
      }`}
      style={{ gridTemplateColumns: `${carCol}px 1fr` }}
    >
      <button
        type="button"
        className="sticky left-0 z-20 min-w-0 border-r border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-2 py-3 text-left hover:bg-[var(--color-surface)] sm:px-3"
        style={{ minHeight: trackH }}
        onClick={() => onCarLabelClick?.(car.id)}
      >
        <div className="truncate text-sm font-semibold text-[var(--color-ink)]">{car.name}</div>
        <div className="truncate text-[11px] text-[var(--color-muted)]">
          {car.status}
          {car.currentLocation ? ` · ${car.currentLocation}` : ''}
        </div>
      </button>
      <div
        data-track="1"
        data-car-id={car.id}
        data-testid={`cal-track-${car.id}`}
        className="relative cursor-pointer bg-[var(--color-surface)]/40"
        style={{ height: trackH }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-event]')) return;
          const at = atFromClientX(e.clientX, e.currentTarget, from, rangeMs);
          onEmptySlot({ carId: car.id, at, clientX: e.clientX, clientY: e.clientY });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if ((e.target as HTMLElement).closest('[data-event]')) return;
          const at = atFromClientX(e.clientX, e.currentTarget, from, rangeMs);
          onEmptySlot({ carId: car.id, at, clientX: e.clientX, clientY: e.clientY });
        }}
        onDragOver={(e) => onTrackDragOver(e, car.id)}
        onDragLeave={() => onTrackDragLeave(car.id)}
        onDrop={(e) => onTrackDrop(e, car.id)}
      >
        {isDayView
          ? hours.map((h) => (
              <div
                key={`g-${h.toISOString()}`}
                className="pointer-events-none absolute inset-y-0 border-l border-[var(--color-line)]/60"
                style={{ left: `${leftPct(h, from, totalMinutes)}%` }}
              />
            ))
          : dayStarts.map((d) => (
              <div
                key={`d-${d.toISOString()}`}
                className="pointer-events-none absolute inset-y-0 border-l border-[var(--color-line)]"
                style={{ left: `${leftPct(d, from, totalMinutes)}%` }}
              />
            ))}

        {nowPct != null ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-[var(--color-danger)]"
            style={{ left: `${nowPct}%` }}
            title="Now (Europe/Sofia)"
          />
        ) : null}

        {ghost?.carId === car.id ? (
          <div
            className="pointer-events-none absolute top-2 z-30 h-7 overflow-hidden rounded-md border border-dashed border-[var(--color-accent)] bg-[var(--color-accent-muted)]/80 px-2 text-[10px] font-medium text-[var(--color-ink)] opacity-90"
            style={{ left: `${ghost.left}%`, width: `${ghost.width}%` }}
          >
            <span className="block truncate">{ghost.title}</span>
          </div>
        ) : null}

        {rowEvents.map((ev) => (
          <TimelineEventBar
            key={ev.id}
            ev={ev}
            lane={lanes.get(ev.id) ?? 0}
            from={from}
            totalMinutes={totalMinutes}
            moving={moving}
            canDragReservations={canDragReservations}
            canDragTasks={canDragTasks}
            canResize={canResize}
            selected={selectedEventId === ev.id}
            onEventClick={onEventClick}
            onReservationOpen={onReservationOpen}
            beginResize={beginResize}
            beginPointerMove={beginPointerMove}
          />
        ))}

        {rowEvents.length === 0 ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-[var(--color-muted)]/50">
            Free
          </span>
        ) : null}
      </div>
    </div>
  );
}
