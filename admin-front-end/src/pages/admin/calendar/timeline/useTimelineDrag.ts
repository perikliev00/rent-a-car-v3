/**
 * Pointer drag/resize state machine for timeline event bars.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { parseISO } from 'date-fns';
import type { CalendarEvent } from '../calendar.types';
import {
  atFromClientX,
  carIdFromTrack,
  computeDrop,
  leftPct,
  widthPct,
  type TimelineDrop,
  type TimelineGhost,
} from './timelineLayout';

/**
 * Ephemeral window globals let HTML5 dragenter/over handlers on other rows
 * read the in-flight drop target without React re-renders every pointer move.
 */
type DragGlobals = {
  __calResize?: { start: number; end: number };
  __calPointerMove?: TimelineDrop;
  __calDragId?: string;
};

/** Clear ephemeral resize/move globals when a gesture ends or the hook unmounts. */
function clearWindowDragState() {
  const w = window as unknown as DragGlobals;
  w.__calResize = undefined;
  w.__calPointerMove = undefined;
}

/**
 * Timeline pointer interactions: edge resize and cross-lane drag.
 * Enforces a 1-hour minimum duration while resizing.
 */
export function useTimelineDrag({
  from,
  rangeMs,
  totalMinutes,
  events,
  moving,
  canResize,
  canDragReservations,
  canDragTasks,
  canDrop,
  onEventClick,
  onMoveRequest,
  onResizeRequest,
}: {
  from: Date;
  rangeMs: number;
  totalMinutes: number;
  events: CalendarEvent[];
  moving: boolean;
  canResize: boolean;
  canDragReservations: boolean;
  canDragTasks: boolean;
  canDrop: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onMoveRequest?: (event: CalendarEvent, start: Date, end: Date, carId: string) => void;
  onResizeRequest?: (event: CalendarEvent, start: Date, end: Date) => void;
}) {
  const [dragOverCarId, setDragOverCarId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<TimelineGhost | null>(null);
  const activePointerId = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      clearWindowDragState();
    };
  }, []);

  /**
   * Start an edge-resize gesture; updates window globals while the pointer moves.
   * @param e - Pointer down on a resize handle
   * @param ev - Event being resized
   * @param edge - Which edge is being dragged
   * @param trackEl - Parent track used for X→time mapping
   */
  function beginResize(
    e: ReactPointerEvent,
    ev: CalendarEvent,
    edge: 'start' | 'end',
    trackEl: HTMLElement | null
  ) {
    if (!canResize || moving || !onResizeRequest || !trackEl) return;
    // Ignore if another pointer gesture is already active.
    if (activePointerId.current != null) return;
    e.preventDefault();
    e.stopPropagation();
    const pointerId = e.pointerId;
    activePointerId.current = pointerId;
    const start0 = parseISO(ev.start).getTime();
    const end0 = parseISO(ev.end).getTime();
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture?.(pointerId);
    } catch {
      // ignore
    }

    const onMove = (evMove: PointerEvent) => {
      if (evMove.pointerId !== pointerId) return;
      const at = atFromClientX(evMove.clientX, trackEl, from, rangeMs).getTime();
      let nextStart = start0;
      let nextEnd = end0;
      // Keep at least one hour so zero-width / inverted ranges cannot be submitted.
      if (edge === 'start') {
        nextStart = Math.min(at, end0 - 60 * 60 * 1000);
      } else {
        nextEnd = Math.max(at, start0 + 60 * 60 * 1000);
      }
      setGhost({
        carId: ev.carId || '',
        left: leftPct(new Date(nextStart), from, totalMinutes),
        width: widthPct(
          new Date(nextStart).toISOString(),
          new Date(nextEnd).toISOString(),
          totalMinutes
        ),
        title: ev.title,
      });
      (window as unknown as DragGlobals).__calResize = {
        start: nextStart,
        end: nextEnd,
      };
    };

    const finish = (evUp: PointerEvent) => {
      if (evUp.pointerId !== pointerId) return;
      teardown();
      const draft = (window as unknown as DragGlobals).__calResize;
      setGhost(null);
      clearWindowDragState();
      if (!draft) return;
      onResizeRequest(ev, new Date(draft.start), new Date(draft.end));
    };

    const teardown = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      activePointerId.current = null;
      cleanupRef.current = null;
      try {
        target.releasePointerCapture?.(pointerId);
      } catch {
        // ignore
      }
    };

    cleanupRef.current = teardown;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  /**
   * Start a pointer-based move (not HTML5 DnD) for reservations/tasks when permitted.
   * Ignores pointer-downs that originated on resize handles.
   */
  function beginPointerMove(
    e: ReactPointerEvent,
    ev: CalendarEvent,
    trackEl: HTMLElement | null
  ) {
    if (moving || !onMoveRequest || !trackEl) return;
    if (ev.type === 'reservation' && !canDragReservations) return;
    if (ev.type === 'task' && !canDragTasks) return;
    if (activePointerId.current != null) return;
    if (
      (e.target as HTMLElement).closest(
        '[data-testid="cal-resize-start"], [data-testid="cal-resize-end"]'
      )
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const pointerId = e.pointerId;
    activePointerId.current = pointerId;
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture?.(pointerId);
    } catch {
      // ignore
    }
    const carId = ev.carId || carIdFromTrack(trackEl) || '';
    const originX = e.clientX;
    const originY = e.clientY;
    const DRAG_THRESHOLD_PX = 10;
    let dragging = false;
    let cancelledByScrollIntent = false;

    const onMove = (evMove: PointerEvent) => {
      if (evMove.pointerId !== pointerId) return;
      const dx = evMove.clientX - originX;
      const dy = evMove.clientY - originY;
      if (!dragging) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) >= DRAG_THRESHOLD_PX) {
          cancelledByScrollIntent = true;
          return;
        }
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
          return;
        }
        dragging = true;
      }
      if (cancelledByScrollIntent) return;
      const drop = computeDrop(
        evMove.clientX,
        trackEl,
        ev,
        carId,
        from,
        rangeMs,
        totalMinutes
      );
      setDragOverCarId(drop.carId);
      setGhost({
        carId: drop.carId,
        left: drop.left,
        width: drop.width,
        title: ev.title,
      });
      (window as unknown as DragGlobals).__calPointerMove = drop;
    };

    const finish = (evUp: PointerEvent) => {
      if (evUp.pointerId !== pointerId) return;
      teardown();
      const draft = (window as unknown as DragGlobals).__calPointerMove;
      setDragOverCarId(null);
      setGhost(null);
      clearWindowDragState();
      if (cancelledByScrollIntent || !dragging || !draft) {
        if (!cancelledByScrollIntent) onEventClick(ev);
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

    const teardown = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      activePointerId.current = null;
      cleanupRef.current = null;
      try {
        target.releasePointerCapture?.(pointerId);
      } catch {
        // ignore
      }
    };

    cleanupRef.current = teardown;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  /** HTML5 dragover: update drop highlight + ghost geometry for the target car row. */
  function onTrackDragOver(e: React.DragEvent<HTMLElement>, carId: string) {
    if (!canDrop || moving) return;
    e.preventDefault();
    setDragOverCarId(carId);
    const draggedId = (window as unknown as DragGlobals).__calDragId;
    if (!draggedId) return;
    const ev = events.find((x) => x.id === draggedId);
    if (!ev) return;
    const drop = computeDrop(
      e.clientX,
      e.currentTarget,
      ev,
      carId,
      from,
      rangeMs,
      totalMinutes
    );
    setGhost({
      carId,
      left: drop.left,
      width: drop.width,
      title: ev.title,
    });
  }

  /** Clear highlight/ghost when the pointer leaves this car track. */
  function onTrackDragLeave(carId: string) {
    setDragOverCarId((prev) => (prev === carId ? null : prev));
    setGhost((g) => (g?.carId === carId ? null : g));
  }

  /** HTML5 drop: commit a move onto this car at the drop X position. */
  function onTrackDrop(e: React.DragEvent<HTMLElement>, carId: string) {
    if (!canDrop || moving || !onMoveRequest) return;
    e.preventDefault();
    const id = e.dataTransfer.getData('text/calendar-event');
    const ev = events.find((x) => x.id === id);
    setDragOverCarId(null);
    setGhost(null);
    (window as unknown as DragGlobals).__calDragId = undefined;
    if (!ev) return;
    const drop = computeDrop(
      e.clientX,
      e.currentTarget,
      ev,
      carId,
      from,
      rangeMs,
      totalMinutes
    );
    onMoveRequest(ev, drop.start, drop.end, carId);
  }

  return {
    dragOverCarId,
    ghost,
    beginResize,
    beginPointerMove,
    onTrackDragOver,
    onTrackDragLeave,
    onTrackDrop,
  };
}
