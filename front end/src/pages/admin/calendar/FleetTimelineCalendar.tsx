import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  addDays,
  differenceInMinutes,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { CalendarCar, CalendarEvent } from './calendar.types';
import { eventBarClass } from './eventStyles';
import { reservationIdFromEvent } from './reservationDeepLink';

const ROW_H = 80;
const LANE_H = 28;
const LANE_GAP = 4;
const CAR_COL = 180;

function nowInSofia(): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Sofia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  return new Date(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')),
    Number(get('minute')),
    Number(get('second'))
  );
}

function assignLanes(events: CalendarEvent[]): Map<string, number> {
  const sorted = [...events].sort(
    (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
  );
  const laneEnds: number[] = [];
  const map = new Map<string, number>();
  for (const ev of sorted) {
    const start = parseISO(ev.start).getTime();
    const end = parseISO(ev.end).getTime();
    let lane = laneEnds.findIndex((t) => t <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    map.set(ev.id, lane);
  }
  return map;
}

export function FleetTimelineCalendar({
  cars,
  events,
  from,
  to,
  onEventClick,
  onEmptySlot,
  onCarLabelClick,
  onReservationOpen,
  canDragReservations = false,
  canDragTasks = false,
  canResize = false,
  moving = false,
  showSkeleton = false,
  selectedEventId = null,
  onMoveRequest,
  onResizeRequest,
}: {
  cars: CalendarCar[];
  events: CalendarEvent[];
  from: Date;
  to: Date;
  onEventClick: (event: CalendarEvent) => void;
  onEmptySlot: (payload: { carId: string; at: Date; clientX: number; clientY: number }) => void;
  onCarLabelClick?: (carId: string) => void;
  onReservationOpen?: (reservationId: string) => void;
  canDragReservations?: boolean;
  canDragTasks?: boolean;
  canResize?: boolean;
  moving?: boolean;
  showSkeleton?: boolean;
  selectedEventId?: string | null;
  onMoveRequest?: (event: CalendarEvent, start: Date, end: Date, carId: string) => void;
  onResizeRequest?: (event: CalendarEvent, start: Date, end: Date) => void;
}) {
  const totalMinutes = Math.max(1, differenceInMinutes(to, from));
  const rangeMs = Math.max(1, to.getTime() - from.getTime());
  const isDayView = isSameDay(from, to) || differenceInMinutes(to, from) <= 24 * 60;
  const [dragOverCarId, setDragOverCarId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{
    carId: string;
    left: number;
    width: number;
    title: string;
  } | null>(null);

  const hours: Date[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += 60 * 60 * 1000) {
    hours.push(new Date(t));
  }

  const dayStarts = useMemo(() => {
    const days: Date[] = [];
    let d = startOfDay(from);
    const end = to.getTime();
    while (d.getTime() < end) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [from, to]);

  const now = nowInSofia();
  const nowInRange = now.getTime() >= from.getTime() && now.getTime() <= to.getTime();
  const nowPct = nowInRange
    ? Math.max(0, Math.min(100, (differenceInMinutes(now, from) / totalMinutes) * 100))
    : null;

  function leftPct(start: string | Date) {
    const s = typeof start === 'string' ? parseISO(start) : start;
    const mins = differenceInMinutes(s, from);
    return Math.max(0, Math.min(100, (mins / totalMinutes) * 100));
  }

  function widthPct(start: string, end: string) {
    const s = parseISO(start);
    const e = parseISO(end);
    const mins = Math.max(30, differenceInMinutes(e, s));
    return Math.max(0.8, Math.min(100, (mins / totalMinutes) * 100));
  }

  function atFromClientX(clientX: number, trackEl: HTMLElement): Date {
    const rect = trackEl.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return new Date(from.getTime() + pct * rangeMs);
  }

  const labelStep = Math.max(1, Math.ceil(hours.length / 12));
  const canDrop = canDragReservations || canDragTasks;

  function computeDrop(
    clientX: number,
    trackEl: HTMLElement,
    ev: CalendarEvent,
    carId: string
  ) {
    const duration = differenceInMinutes(parseISO(ev.end), parseISO(ev.start));
    const rect = trackEl.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const startMs = from.getTime() + pct * rangeMs;
    const start = new Date(startMs);
    const end = new Date(startMs + Math.max(60, duration) * 60 * 1000);
    return {
      start,
      end,
      carId,
      left: pct * 100,
      width: widthPct(start.toISOString(), end.toISOString()),
    };
  }

  function beginResize(
    e: ReactPointerEvent,
    ev: CalendarEvent,
    edge: 'start' | 'end',
    trackEl: HTMLElement | null
  ) {
    if (!canResize || moving || !onResizeRequest || !trackEl) return;
    e.preventDefault();
    e.stopPropagation();
    const start0 = parseISO(ev.start).getTime();
    const end0 = parseISO(ev.end).getTime();
    const onMove = (evMove: PointerEvent) => {
      const at = atFromClientX(evMove.clientX, trackEl).getTime();
      let nextStart = start0;
      let nextEnd = end0;
      if (edge === 'start') {
        nextStart = Math.min(at, end0 - 60 * 60 * 1000);
      } else {
        nextEnd = Math.max(at, start0 + 60 * 60 * 1000);
      }
      setGhost({
        carId: ev.carId || '',
        left: leftPct(new Date(nextStart)),
        width: widthPct(new Date(nextStart).toISOString(), new Date(nextEnd).toISOString()),
        title: ev.title,
      });
      (window as unknown as { __calResize?: { start: number; end: number } }).__calResize = {
        start: nextStart,
        end: nextEnd,
      };
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const draft = (window as unknown as { __calResize?: { start: number; end: number } })
        .__calResize;
      setGhost(null);
      (window as unknown as { __calResize?: undefined }).__calResize = undefined;
      if (!draft) return;
      onResizeRequest(ev, new Date(draft.start), new Date(draft.end));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  /** Pointer drag-move (same interaction model as resize; reliable for e2e + touch). */
  function beginPointerMove(
    e: ReactPointerEvent,
    ev: CalendarEvent,
    trackEl: HTMLElement | null
  ) {
    if (moving || !onMoveRequest || !trackEl) return;
    if (ev.type === 'reservation' && !canDragReservations) return;
    if (ev.type === 'task' && !canDragTasks) return;
    if ((e.target as HTMLElement).closest('[data-testid="cal-resize-start"], [data-testid="cal-resize-end"]')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    const carId = ev.carId || carIdFromTrack(trackEl) || '';
    const originX = e.clientX;
    const originY = e.clientY;
    const DRAG_THRESHOLD_PX = 6;
    let dragging = false;
    const onMove = (evMove: PointerEvent) => {
      const dx = evMove.clientX - originX;
      const dy = evMove.clientY - originY;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
        return;
      }
      dragging = true;
      const drop = computeDrop(evMove.clientX, trackEl, ev, carId);
      setDragOverCarId(drop.carId);
      setGhost({
        carId: drop.carId,
        left: drop.left,
        width: drop.width,
        title: ev.title,
      });
      (window as unknown as { __calPointerMove?: ReturnType<typeof computeDrop> }).__calPointerMove =
        drop;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const draft = (window as unknown as { __calPointerMove?: ReturnType<typeof computeDrop> })
        .__calPointerMove;
      setDragOverCarId(null);
      setGhost(null);
      (window as unknown as { __calPointerMove?: undefined }).__calPointerMove = undefined;
      if (!dragging || !draft) {
        // Tap / sub-threshold: open details (pointerdown preventDefault suppresses click)
        onEventClick(ev);
        return;
      }
      const same =
        Math.abs(draft.start.getTime() - parseISO(ev.start).getTime()) < 60_000 &&
        Math.abs(draft.end.getTime() - parseISO(ev.end).getTime()) < 60_000 &&
        draft.carId === (ev.carId || carId);
      if (same) {
        onEventClick(ev);
        return;
      }
      onMoveRequest(ev, draft.start, draft.end, draft.carId);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function carIdFromTrack(trackEl: HTMLElement) {
    return trackEl.getAttribute('data-car-id') || '';
  }

  if (showSkeleton && cars.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex h-20 animate-pulse border-b border-[var(--color-line)] last:border-b-0"
          >
            <div className="w-[180px] bg-[var(--color-surface)]/80 p-3">
              <div className="h-3 w-24 rounded bg-[var(--color-line)]" />
              <div className="mt-2 h-2 w-16 rounded bg-[var(--color-line)]" />
            </div>
            <div className="flex-1 bg-[var(--color-surface)]/40" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-soft)]">
      <div className="min-w-[900px]">
        <div
          className="sticky top-0 z-30 grid border-b border-[var(--color-line)] bg-[var(--color-surface)]"
          style={{ gridTemplateColumns: `${CAR_COL}px 1fr` }}
        >
          <div className="sticky left-0 z-40 border-r border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Car
          </div>
          <div className="relative h-10">
            {hours
              .filter((_, i) => i % labelStep === 0)
              .map((h) => (
                <div
                  key={h.toISOString()}
                  className="absolute top-1 text-[10px] text-[var(--color-muted)]"
                  style={{ left: `${leftPct(h)}%` }}
                >
                  {isDayView ? format(h, 'HH:mm') : format(h, 'MMM d HH:mm')}
                </div>
              ))}
          </div>
        </div>

        {cars.map((car) => {
          const rowEvents = events.filter((e) => e.carId === car.id);
          const lanes = assignLanes(rowEvents);
          const maxLane = rowEvents.reduce((m, e) => Math.max(m, lanes.get(e.id) ?? 0), 0);
          const trackH = Math.max(ROW_H, 12 + (maxLane + 1) * (LANE_H + LANE_GAP));
          const isTarget = dragOverCarId === car.id;

          return (
            <div
              key={car.id}
              className={`grid border-b border-[var(--color-line)] last:border-b-0 ${
                isTarget ? 'bg-[var(--color-accent-muted)]/40' : ''
              }`}
              style={{ gridTemplateColumns: `${CAR_COL}px 1fr` }}
            >
              <button
                type="button"
                className="sticky left-0 z-20 border-r border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-3 py-3 text-left hover:bg-[var(--color-surface)]"
                style={{ minHeight: trackH }}
                onClick={() => onCarLabelClick?.(car.id)}
              >
                <div className="text-sm font-semibold text-[var(--color-ink)]">{car.name}</div>
                <div className="text-[11px] text-[var(--color-muted)]">
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
                  const at = atFromClientX(e.clientX, e.currentTarget);
                  onEmptySlot({ carId: car.id, at, clientX: e.clientX, clientY: e.clientY });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if ((e.target as HTMLElement).closest('[data-event]')) return;
                  const at = atFromClientX(e.clientX, e.currentTarget);
                  onEmptySlot({ carId: car.id, at, clientX: e.clientX, clientY: e.clientY });
                }}
                onDragOver={(e) => {
                  if (!canDrop || moving) return;
                  e.preventDefault();
                  setDragOverCarId(car.id);
                  const draggedId = (window as unknown as { __calDragId?: string }).__calDragId;
                  if (!draggedId) return;
                  const ev = events.find((x) => x.id === draggedId);
                  if (!ev) return;
                  const drop = computeDrop(e.clientX, e.currentTarget, ev, car.id);
                  setGhost({
                    carId: car.id,
                    left: drop.left,
                    width: drop.width,
                    title: ev.title,
                  });
                }}
                onDragLeave={() => {
                  setDragOverCarId((prev) => (prev === car.id ? null : prev));
                  setGhost((g) => (g?.carId === car.id ? null : g));
                }}
                onDrop={(e) => {
                  if (!canDrop || moving || !onMoveRequest) return;
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/calendar-event');
                  const ev = events.find((x) => x.id === id);
                  setDragOverCarId(null);
                  setGhost(null);
                  (window as unknown as { __calDragId?: string }).__calDragId = undefined;
                  if (!ev) return;
                  const drop = computeDrop(e.clientX, e.currentTarget, ev, car.id);
                  onMoveRequest(ev, drop.start, drop.end, car.id);
                }}
              >
                {isDayView
                  ? hours.map((h) => (
                      <div
                        key={`g-${h.toISOString()}`}
                        className="pointer-events-none absolute inset-y-0 border-l border-[var(--color-line)]/60"
                        style={{ left: `${leftPct(h)}%` }}
                      />
                    ))
                  : dayStarts.map((d) => (
                      <div
                        key={`d-${d.toISOString()}`}
                        className="pointer-events-none absolute inset-y-0 border-l border-[var(--color-line)]"
                        style={{ left: `${leftPct(d)}%` }}
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

                {rowEvents.map((ev) => {
                  const lane = lanes.get(ev.id) ?? 0;
                  const movable =
                    !moving &&
                    ((canDragReservations && ev.type === 'reservation') ||
                      (canDragTasks && ev.type === 'task'));
                  const resizable = canResize && !moving && ev.type === 'reservation';
                  const selected = selectedEventId === ev.id;
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
                      key={ev.id}
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
                        left: `${leftPct(ev.start)}%`,
                        width: `${widthPct(ev.start, ev.end)}%`,
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
                })}

                {rowEvents.length === 0 ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-[var(--color-muted)]/50">
                    Free
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        {cars.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--color-muted)]">No cars in this view</p>
        ) : null}
      </div>
    </div>
  );
}
