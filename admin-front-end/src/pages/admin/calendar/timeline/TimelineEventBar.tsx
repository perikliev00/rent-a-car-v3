/**
 * Draggable/resizable event bar rendering for the timeline.
 */
import { format, parseISO } from 'date-fns';
// Apply the TypeScript type assertion for this value.
import type { PointerEvent as ReactPointerEvent } from 'react';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarEvent } from '../calendar.types';
// Import named exports from '../eventStyles'.
import { eventBarClass } from '../eventStyles';
// Import named exports from '../reservationDeepLink'.
import { reservationIdFromEvent } from '../reservationDeepLink';
// Import named exports from './timelineLayout'.
import { LANE_GAP, LANE_H, leftPct, widthPct } from './timelineLayout';

/** Draggable/resizable event bar rendering for the timeline. */
export function TimelineEventBar({
  // Contribute this line to the enclosing declaration or statement.
  ev,
  // Contribute this line to the enclosing declaration or statement.
  lane,
  // Contribute this line to the enclosing declaration or statement.
  from,
  // Contribute this line to the enclosing declaration or statement.
  totalMinutes,
  // Contribute this line to the enclosing declaration or statement.
  moving,
  // Contribute this line to the enclosing declaration or statement.
  canDragReservations,
  // Contribute this line to the enclosing declaration or statement.
  canDragTasks,
  // Contribute this line to the enclosing declaration or statement.
  canResize,
  // Contribute this line to the enclosing declaration or statement.
  selected,
  // Contribute this line to the enclosing declaration or statement.
  onEventClick,
  // Contribute this line to the enclosing declaration or statement.
  onReservationOpen,
  // Contribute this line to the enclosing declaration or statement.
  beginResize,
  // Contribute this line to the enclosing declaration or statement.
  beginPointerMove,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the ev field value.
  ev: CalendarEvent;
  // Provide the lane field value.
  lane: number;
  // Provide the from field value.
  from: Date;
  // Provide the total minutes field value.
  totalMinutes: number;
  // Provide the moving field value.
  moving: boolean;
  // Provide the can drag reservations field value.
  canDragReservations: boolean;
  // Provide the can drag tasks field value.
  canDragTasks: boolean;
  // Provide the can resize field value.
  canResize: boolean;
  // Provide the selected field value.
  selected: boolean;
  // Provide the on event click field value.
  onEventClick: (event: CalendarEvent) => void;
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
// Continue the surrounding logic with this statement.
}) {
  // Create the movable constant.
  const movable =
    // Contribute this line to the enclosing declaration or statement.
    !moving &&
    // Continue the surrounding logic with this statement.
    ((canDragReservations && ev.type === 'reservation') ||
      // Continue the surrounding logic with this statement.
      (canDragTasks && ev.type === 'task'));
  // Create the resizable constant.
  const resizable = canResize && !moving && ev.type === 'reservation';
  // Create the tip constant.
  const tip = `${ev.title} · ${ev.type}${ev.status ? ` · ${ev.status}` : ''} · ${format(parseISO(ev.start), 'MMM d HH:mm')}–${format(parseISO(ev.end), 'MMM d HH:mm')}`;
  // Create the rid constant.
  const rid = reservationIdFromEvent(ev);
  // Create the tid constant.
  const tid =
    // Update ev.type with the right-hand side value.
    ev.type === 'task'
      // Continue the surrounding logic with this statement.
      ? String(ev.id).startsWith('task:')
        // Continue the surrounding logic with this statement.
        ? String(ev.id).slice(5)
        // Continue the surrounding logic with this statement.
        : (ev as { taskId?: string | number }).taskId != null
          // Continue the surrounding logic with this statement.
          ? String((ev as { taskId?: string | number }).taskId)
          // Contribute this line to the enclosing declaration or statement.
          : null
      // Contribute this line to the enclosing declaration or statement.
      : null;

  // Return control to the caller with the following value.
  return (
    <div
      data-event="1"
      data-cal-event-id={ev.id}
      data-testid={
        ev.type === 'reservation' && rid
          ? `cal-event-${rid}`
          : ev.type === 'task' && tid
            ? `cal-event-task-${tid}`
            : undefined
      }
      title={tip}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(ev);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (rid && onReservationOpen) onReservationOpen(rid);
      }}
      className={`absolute z-10 overflow-hidden rounded-md border-l-[3px] px-2 text-left text-[11px] font-medium shadow-sm transition-transform duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-md ${
        eventBarClass(ev.type)
      } ${movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
        moving ? 'pointer-events-none opacity-60' : ''
      } ${selected ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : ''}`}
      style={{
        left: `${leftPct(ev.start, from, totalMinutes)}%`,
        width: `${widthPct(ev.start, ev.end, totalMinutes)}%`,
        top: 8 + lane * (LANE_H + LANE_GAP),
        height: LANE_H,
      }}
    >
      {resizable ? (
        <>
          <span
            data-testid="cal-resize-start"
            className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-ew-resize bg-white/30"
            onPointerDown={(e) =>
              beginResize(
                e,
                ev,
                'start',
                (e.currentTarget.closest('[data-track]') as HTMLElement) || null
              )
            }
          />
          <span
            data-testid="cal-resize-end"
            className="absolute inset-y-0 right-0 z-20 w-1.5 cursor-ew-resize bg-white/30"
            onPointerDown={(e) =>
              beginResize(
                e,
                ev,
                'end',
                (e.currentTarget.closest('[data-track]') as HTMLElement) || null
              )
            }
          />
        </>
      ) : null}
      {movable ? (
        <span
          data-testid="cal-move-handle"
          className="absolute inset-x-2 inset-y-0 z-[15] cursor-grab active:cursor-grabbing"
          onPointerDown={(e) =>
            beginPointerMove(
              e,
              ev,
              (e.currentTarget.closest('[data-track]') as HTMLElement) || null
            )
          }
        />
      ) : null}
      <span className="pointer-events-none relative z-0 block truncate">
        {format(parseISO(ev.start), 'HH:mm')} {ev.title}
      </span>
    </div>
  );
}
