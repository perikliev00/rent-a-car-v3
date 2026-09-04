import { format, parseISO } from 'date-fns';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CalendarEvent } from '../calendar.types';
import { eventBarClass } from '../eventStyles';
import { reservationIdFromEvent } from '../reservationDeepLink';
import { LANE_GAP, LANE_H, leftPct, widthPct } from './timelineLayout';

export function TimelineEventBar({
  ev,
  lane,
  from,
  totalMinutes,
  moving,
  canDragReservations,
  canDragTasks,
  canResize,
  selected,
  onEventClick,
  onReservationOpen,
  beginResize,
  beginPointerMove,
}: {
  ev: CalendarEvent;
  lane: number;
  from: Date;
  totalMinutes: number;
  moving: boolean;
  canDragReservations: boolean;
  canDragTasks: boolean;
  canResize: boolean;
  selected: boolean;
  onEventClick: (event: CalendarEvent) => void;
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
}) {
  const movable =
    !moving &&
    ((canDragReservations && ev.type === 'reservation') ||
      (canDragTasks && ev.type === 'task'));
  const resizable = canResize && !moving && ev.type === 'reservation';
  const tip = `${ev.title} · ${ev.type}${ev.status ? ` · ${ev.status}` : ''} · ${format(parseISO(ev.start), 'MMM d HH:mm')}–${format(parseISO(ev.end), 'MMM d HH:mm')}`;
  const rid = reservationIdFromEvent(ev);
  const tid =
    ev.type === 'task'
      ? String(ev.id).startsWith('task:')
        ? String(ev.id).slice(5)
        : (ev as { taskId?: string | number }).taskId != null
          ? String((ev as { taskId?: string | number }).taskId)
          : null
      : null;

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
