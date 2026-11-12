/**
 * One car lane in the fleet timeline with event bars.
 */
import type { PointerEvent as ReactPointerEvent } from 'react';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarCar, CalendarEvent } from '../calendar.types';
// Import named exports from './TimelineEventBar'.
import { TimelineEventBar } from './TimelineEventBar';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  assignLanes,
  // Contribute this line to the enclosing declaration or statement.
  atFromClientX,
  // Contribute this line to the enclosing declaration or statement.
  leftPct,
  // Contribute this line to the enclosing declaration or statement.
  trackHeight,
  // Declare the TimelineGhost TypeScript type alias.
  type TimelineGhost,
// Contribute this line to the enclosing declaration or statement.
} from './timelineLayout';

/** One car lane in the fleet timeline with event bars. */
export function TimelineCarRow({
  // Contribute this line to the enclosing declaration or statement.
  car,
  // Contribute this line to the enclosing declaration or statement.
  events,
  // Contribute this line to the enclosing declaration or statement.
  from,
  // Contribute this line to the enclosing declaration or statement.
  rangeMs,
  // Contribute this line to the enclosing declaration or statement.
  totalMinutes,
  // Contribute this line to the enclosing declaration or statement.
  isDayView,
  // Contribute this line to the enclosing declaration or statement.
  hours,
  // Contribute this line to the enclosing declaration or statement.
  dayStarts,
  // Contribute this line to the enclosing declaration or statement.
  nowPct,
  // Contribute this line to the enclosing declaration or statement.
  ghost,
  // Contribute this line to the enclosing declaration or statement.
  isTarget,
  // Contribute this line to the enclosing declaration or statement.
  moving,
  // Contribute this line to the enclosing declaration or statement.
  canDragReservations,
  // Contribute this line to the enclosing declaration or statement.
  canDragTasks,
  // Contribute this line to the enclosing declaration or statement.
  canResize,
  // Contribute this line to the enclosing declaration or statement.
  selectedEventId,
  // Contribute this line to the enclosing declaration or statement.
  carCol,
  // Contribute this line to the enclosing declaration or statement.
  onEventClick,
  // Contribute this line to the enclosing declaration or statement.
  onEmptySlot,
  // Contribute this line to the enclosing declaration or statement.
  onCarLabelClick,
  // Contribute this line to the enclosing declaration or statement.
  onReservationOpen,
  // Contribute this line to the enclosing declaration or statement.
  beginResize,
  // Contribute this line to the enclosing declaration or statement.
  beginPointerMove,
  // Contribute this line to the enclosing declaration or statement.
  onTrackDragOver,
  // Contribute this line to the enclosing declaration or statement.
  onTrackDragLeave,
  // Contribute this line to the enclosing declaration or statement.
  onTrackDrop,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the car field value.
  car: CalendarCar;
  // Provide the events field value.
  events: CalendarEvent[];
  // Provide the from field value.
  from: Date;
  // Provide the range ms field value.
  rangeMs: number;
  // Provide the total minutes field value.
  totalMinutes: number;
  // Provide the is day view field value.
  isDayView: boolean;
  // Provide the hours field value.
  hours: Date[];
  // Provide the day starts field value.
  dayStarts: Date[];
  // Provide the now pct field value.
  nowPct: number | null;
  // Provide the ghost field value.
  ghost: TimelineGhost | null;
  // Provide the is target field value.
  isTarget: boolean;
  // Provide the moving field value.
  moving: boolean;
  // Provide the can drag reservations field value.
  canDragReservations: boolean;
  // Provide the can drag tasks field value.
  canDragTasks: boolean;
  // Provide the can resize field value.
  canResize: boolean;
  // Contribute this line to the enclosing declaration or statement.
  selectedEventId?: string | null;
  // Provide the car col field value.
  carCol: number;
  // Provide the on event click field value.
  onEventClick: (event: CalendarEvent) => void;
  // Provide the on empty slot field value.
  onEmptySlot: (payload: { carId: string; at: Date; clientX: number; clientY: number }) => void;
  // Continue the surrounding logic with this statement.
  onCarLabelClick?: (carId: string) => void;
  // Continue the surrounding logic with this statement.
  onReservationOpen?: (reservationId: string) => void;
  // Provide the begin resize field value.
  beginResize: (
    // Provide the e field value.
    e: ReactPointerEvent,
    // Provide the ev field value.
    ev: CalendarEvent,
    // Provide the edge field value.
    edge: 'start' | 'end',
    // Provide the track el field value.
    trackEl: HTMLElement | null
  // Continue the surrounding logic with this statement.
  ) => void;
  // Provide the begin pointer move field value.
  beginPointerMove: (
    // Provide the e field value.
    e: ReactPointerEvent,
    // Provide the ev field value.
    ev: CalendarEvent,
    // Provide the track el field value.
    trackEl: HTMLElement | null
  // Continue the surrounding logic with this statement.
  ) => void;
  // Provide the on track drag over field value.
  onTrackDragOver: (e: React.DragEvent<HTMLElement>, carId: string) => void;
  // Provide the on track drag leave field value.
  onTrackDragLeave: (carId: string) => void;
  // Provide the on track drop field value.
  onTrackDrop: (e: React.DragEvent<HTMLElement>, carId: string) => void;
// Continue the surrounding logic with this statement.
}) {
  // Create the row events constant.
  const rowEvents = events.filter((e) => e.carId === car.id);
  // Create the lanes constant.
  const lanes = assignLanes(rowEvents);
  // Create the max lane constant.
  const maxLane = rowEvents.reduce((m, e) => Math.max(m, lanes.get(e.id) ?? 0), 0);
  // Create the track h constant.
  const trackH = trackHeight(maxLane);

  // Return control to the caller with the following value.
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
