/**
 * Pointer drag/resize state machine for timeline event bars.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
// Import named exports from 'date-fns'.
import { parseISO } from 'date-fns';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarEvent } from '../calendar.types';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  atFromClientX,
  // Contribute this line to the enclosing declaration or statement.
  carIdFromTrack,
  // Contribute this line to the enclosing declaration or statement.
  computeDrop,
  // Contribute this line to the enclosing declaration or statement.
  leftPct,
  // Contribute this line to the enclosing declaration or statement.
  widthPct,
  // Declare the TimelineDrop TypeScript type alias.
  type TimelineDrop,
  // Declare the TimelineGhost TypeScript type alias.
  type TimelineGhost,
// Contribute this line to the enclosing declaration or statement.
} from './timelineLayout';

/**
 * Ephemeral window globals let HTML5 dragenter/over handlers on other rows
 * read the in-flight drop target without React re-renders every pointer move.
 */
type DragGlobals = {
  // Contribute this line to the enclosing declaration or statement.
  __calResize?: { start: number; end: number };
  // Contribute this line to the enclosing declaration or statement.
  __calPointerMove?: TimelineDrop;
  // Contribute this line to the enclosing declaration or statement.
  __calDragId?: string;
};

/** Clear ephemeral resize/move globals when a gesture ends or the hook unmounts. */
function clearWindowDragState() {
  // Create the w constant.
  const w = window as unknown as DragGlobals;
  // Update w.__calResize with the right-hand side value.
  w.__calResize = undefined;
  // Update w.__calPointerMove with the right-hand side value.
  w.__calPointerMove = undefined;
}

/**
 * Timeline pointer interactions: edge resize and cross-lane drag.
 * Enforces a 1-hour minimum duration while resizing.
 */
export function useTimelineDrag({
  // Contribute this line to the enclosing declaration or statement.
  from,
  // Contribute this line to the enclosing declaration or statement.
  rangeMs,
  // Contribute this line to the enclosing declaration or statement.
  totalMinutes,
  // Contribute this line to the enclosing declaration or statement.
  events,
  // Contribute this line to the enclosing declaration or statement.
  moving,
  // Contribute this line to the enclosing declaration or statement.
  canResize,
  // Contribute this line to the enclosing declaration or statement.
  canDragReservations,
  // Contribute this line to the enclosing declaration or statement.
  canDragTasks,
  // Contribute this line to the enclosing declaration or statement.
  canDrop,
  // Contribute this line to the enclosing declaration or statement.
  onEventClick,
  // Contribute this line to the enclosing declaration or statement.
  onMoveRequest,
  // Contribute this line to the enclosing declaration or statement.
  onResizeRequest,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the from field value.
  from: Date;
  // Provide the range ms field value.
  rangeMs: number;
  // Provide the total minutes field value.
  totalMinutes: number;
  // Provide the events field value.
  events: CalendarEvent[];
  // Provide the moving field value.
  moving: boolean;
  // Provide the can resize field value.
  canResize: boolean;
  // Provide the can drag reservations field value.
  canDragReservations: boolean;
  // Provide the can drag tasks field value.
  canDragTasks: boolean;
  // Provide the can drop field value.
  canDrop: boolean;
  // Provide the on event click field value.
  onEventClick: (event: CalendarEvent) => void;
  // Continue the surrounding logic with this statement.
  onMoveRequest?: (event: CalendarEvent, start: Date, end: Date, carId: string) => void;
  // Continue the surrounding logic with this statement.
  onResizeRequest?: (event: CalendarEvent, start: Date, end: Date) => void;
// Continue the surrounding logic with this statement.
}) {
  // Destructure array values into local variables.
  const [dragOverCarId, setDragOverCarId] = useState<string | null>(null);
  // Destructure array values into local variables.
  const [ghost, setGhost] = useState<TimelineGhost | null>(null);
  // Create the active pointer id constant.
  const activePointerId = useRef<number | null>(null);
  // Create the cleanup ref constant.
  const cleanupRef = useRef<(() => void) | null>(null);

  // Call useEffect to perform this step.
  useEffect(() => {
    // Return the resulting value to the caller.
    return () => {
      // Continue the surrounding logic with this statement.
      cleanupRef.current?.();
      // Update cleanupRef.current with the right-hand side value.
      cleanupRef.current = null;
      // Call clearWindowDragState to perform this step.
      clearWindowDragState();
    };
  // Continue the surrounding logic with this statement.
  }, []);

  /**
   * Start an edge-resize gesture; updates window globals while the pointer moves.
   * @param e - Pointer down on a resize handle
   * @param ev - Event being resized
   * @param edge - Which edge is being dragged
   * @param trackEl - Parent track used for X→time mapping
   */
  function beginResize(
    // Provide the e field value.
    e: ReactPointerEvent,
    // Provide the ev field value.
    ev: CalendarEvent,
    // Provide the edge field value.
    edge: 'start' | 'end',
    // Provide the track el field value.
    trackEl: HTMLElement | null
  // Continue the surrounding logic with this statement.
  ) {
    // Evaluate the condition and enter the branch when it is true.
    if (!canResize || moving || !onResizeRequest || !trackEl) return;
    // Ignore if another pointer gesture is already active.
    if (activePointerId.current != null) return;
    // Call e.preventDefault to perform this step.
    e.preventDefault();
    // Call e.stopPropagation to perform this step.
    e.stopPropagation();
    // Create the pointer id constant.
    const pointerId = e.pointerId;
    // Update activePointerId.current with the right-hand side value.
    activePointerId.current = pointerId;
    // Create the start0 constant.
    const start0 = parseISO(ev.start).getTime();
    // Create the end0 constant.
    const end0 = parseISO(ev.end).getTime();
    // Create the target constant.
    const target = e.currentTarget as HTMLElement;
    // Start a try block for operations that may fail.
    try {
      // Continue the surrounding logic with this statement.
      target.setPointerCapture?.(pointerId);
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // ignore
    }

    // Create the on move constant.
    const onMove = (evMove: PointerEvent) => {
      // Evaluate the condition and enter the branch when it is true.
      if (evMove.pointerId !== pointerId) return;
      // Create the at constant.
      const at = atFromClientX(evMove.clientX, trackEl, from, rangeMs).getTime();
      // Initialize the mutable next start variable.
      let nextStart = start0;
      // Initialize the mutable next end variable.
      let nextEnd = end0;
      // Keep at least one hour so zero-width / inverted ranges cannot be submitted.
      if (edge === 'start') {
        // Update nextStart with the right-hand side value.
        nextStart = Math.min(at, end0 - 60 * 60 * 1000);
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Update nextEnd with the right-hand side value.
        nextEnd = Math.max(at, start0 + 60 * 60 * 1000);
      }
      // Call setGhost to perform this step.
      setGhost({
        // Provide the car id field value.
        carId: ev.carId || '',
        // Provide the left field value.
        left: leftPct(new Date(nextStart), from, totalMinutes),
        // Provide the width field value.
        width: widthPct(
          // Continue the surrounding logic with this statement.
          new Date(nextStart).toISOString(),
          // Continue the surrounding logic with this statement.
          new Date(nextEnd).toISOString(),
          // Reference the identifier used by the enclosing expression.
          totalMinutes
        ),
        // Provide the title field value.
        title: ev.title,
      });
      // Continue the surrounding logic with this statement.
      (window as unknown as DragGlobals).__calResize = {
        // Provide the start field value.
        start: nextStart,
        // Provide the end field value.
        end: nextEnd,
      };
    };

    // Create the finish constant.
    const finish = (evUp: PointerEvent) => {
      // Evaluate the condition and enter the branch when it is true.
      if (evUp.pointerId !== pointerId) return;
      // Call teardown to perform this step.
      teardown();
      // Create the draft constant.
      const draft = (window as unknown as DragGlobals).__calResize;
      // Call setGhost to perform this step.
      setGhost(null);
      // Call clearWindowDragState to perform this step.
      clearWindowDragState();
      // Evaluate the condition and enter the branch when it is true.
      if (!draft) return;
      // Call onResizeRequest to perform this step.
      onResizeRequest(ev, new Date(draft.start), new Date(draft.end));
    };

    // Create the teardown constant.
    const teardown = () => {
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('pointermove', onMove);
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('pointerup', finish);
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('pointercancel', finish);
      // Update activePointerId.current with the right-hand side value.
      activePointerId.current = null;
      // Update cleanupRef.current with the right-hand side value.
      cleanupRef.current = null;
      // Start a try block for operations that may fail.
      try {
        // Continue the surrounding logic with this statement.
        target.releasePointerCapture?.(pointerId);
      // Contribute this line to the enclosing declaration or statement.
      } catch {
        // ignore
      }
    };

    // Update cleanupRef.current with the right-hand side value.
    cleanupRef.current = teardown;
    // Call window.addEventListener to perform this step.
    window.addEventListener('pointermove', onMove);
    // Call window.addEventListener to perform this step.
    window.addEventListener('pointerup', finish);
    // Call window.addEventListener to perform this step.
    window.addEventListener('pointercancel', finish);
  }

  /**
   * Start a pointer-based move (not HTML5 DnD) for reservations/tasks when permitted.
   * Ignores pointer-downs that originated on resize handles.
   */
  function beginPointerMove(
    // Provide the e field value.
    e: ReactPointerEvent,
    // Provide the ev field value.
    ev: CalendarEvent,
    // Provide the track el field value.
    trackEl: HTMLElement | null
  // Continue the surrounding logic with this statement.
  ) {
    // Evaluate the condition and enter the branch when it is true.
    if (moving || !onMoveRequest || !trackEl) return;
    // Evaluate the condition and enter the branch when it is true.
    if (ev.type === 'reservation' && !canDragReservations) return;
    // Evaluate the condition and enter the branch when it is true.
    if (ev.type === 'task' && !canDragTasks) return;
    // Evaluate the condition and enter the branch when it is true.
    if (activePointerId.current != null) return;
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Continue the surrounding logic with this statement.
      (e.target as HTMLElement).closest(
        // Continue the surrounding logic with this statement.
        '[data-testid="cal-resize-start"], [data-testid="cal-resize-end"]'
      )
    // Continue the surrounding logic with this statement.
    ) {
      // Return control to the caller with the following value.
      return;
    }
    // Call e.preventDefault to perform this step.
    e.preventDefault();
    // Call e.stopPropagation to perform this step.
    e.stopPropagation();
    // Create the pointer id constant.
    const pointerId = e.pointerId;
    // Update activePointerId.current with the right-hand side value.
    activePointerId.current = pointerId;
    // Create the target constant.
    const target = e.currentTarget as HTMLElement;
    // Start a try block for operations that may fail.
    try {
      // Continue the surrounding logic with this statement.
      target.setPointerCapture?.(pointerId);
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // ignore
    }
    // Create the car id constant.
    const carId = ev.carId || carIdFromTrack(trackEl) || '';
    // Create the origin x constant.
    const originX = e.clientX;
    // Create the origin y constant.
    const originY = e.clientY;
    // Create the drag threshold px constant.
    const DRAG_THRESHOLD_PX = 10;
    // Initialize the mutable dragging variable.
    let dragging = false;
    // Initialize the mutable cancelled by scroll intent variable.
    let cancelledByScrollIntent = false;

    // Create the on move constant.
    const onMove = (evMove: PointerEvent) => {
      // Evaluate the condition and enter the branch when it is true.
      if (evMove.pointerId !== pointerId) return;
      // Create the dx constant.
      const dx = evMove.clientX - originX;
      // Create the dy constant.
      const dy = evMove.clientY - originY;
      // Evaluate the condition and enter the branch when it is true.
      if (!dragging) {
        // Evaluate the condition and enter the branch when it is true.
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) >= DRAG_THRESHOLD_PX) {
          // Update cancelledByScrollIntent with the right-hand side value.
          cancelledByScrollIntent = true;
          // Return control to the caller with the following value.
          return;
        }
        // Evaluate the condition and enter the branch when it is true.
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
          // Return control to the caller with the following value.
          return;
        }
        // Update dragging with the right-hand side value.
        dragging = true;
      }
      // Evaluate the condition and enter the branch when it is true.
      if (cancelledByScrollIntent) return;
      // Create the drop constant.
      const drop = computeDrop(
        // Contribute this line to the enclosing declaration or statement.
        evMove.clientX,
        // Contribute this line to the enclosing declaration or statement.
        trackEl,
        // Contribute this line to the enclosing declaration or statement.
        ev,
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        from,
        // Contribute this line to the enclosing declaration or statement.
        rangeMs,
        // Reference the identifier used by the enclosing expression.
        totalMinutes
      );
      // Call setDragOverCarId to perform this step.
      setDragOverCarId(drop.carId);
      // Call setGhost to perform this step.
      setGhost({
        // Provide the car id field value.
        carId: drop.carId,
        // Provide the left field value.
        left: drop.left,
        // Provide the width field value.
        width: drop.width,
        // Provide the title field value.
        title: ev.title,
      });
      // Continue the surrounding logic with this statement.
      (window as unknown as DragGlobals).__calPointerMove = drop;
    };

    // Create the finish constant.
    const finish = (evUp: PointerEvent) => {
      // Evaluate the condition and enter the branch when it is true.
      if (evUp.pointerId !== pointerId) return;
      // Call teardown to perform this step.
      teardown();
      // Create the draft constant.
      const draft = (window as unknown as DragGlobals).__calPointerMove;
      // Call setDragOverCarId to perform this step.
      setDragOverCarId(null);
      // Call setGhost to perform this step.
      setGhost(null);
      // Call clearWindowDragState to perform this step.
      clearWindowDragState();
      // Evaluate the condition and enter the branch when it is true.
      if (cancelledByScrollIntent || !dragging || !draft) {
        // Evaluate the condition and enter the branch when it is true.
        if (!cancelledByScrollIntent) onEventClick(ev);
        // Return control to the caller with the following value.
        return;
      }
      // Create the same constant.
      const same =
        // Call Math.abs to perform this step.
        Math.abs(draft.start.getTime() - parseISO(ev.start).getTime()) < 60_000 &&
        // Call Math.abs to perform this step.
        Math.abs(draft.end.getTime() - parseISO(ev.end).getTime()) < 60_000 &&
        // Update draft.carId with the right-hand side value.
        draft.carId === (ev.carId || carId);
      // Evaluate the condition and enter the branch when it is true.
      if (same) {
        // Call onEventClick to perform this step.
        onEventClick(ev);
        // Return control to the caller with the following value.
        return;
      }
      // Call onMoveRequest to perform this step.
      onMoveRequest(ev, draft.start, draft.end, draft.carId);
    };

    // Create the teardown constant.
    const teardown = () => {
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('pointermove', onMove);
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('pointerup', finish);
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('pointercancel', finish);
      // Update activePointerId.current with the right-hand side value.
      activePointerId.current = null;
      // Update cleanupRef.current with the right-hand side value.
      cleanupRef.current = null;
      // Start a try block for operations that may fail.
      try {
        // Continue the surrounding logic with this statement.
        target.releasePointerCapture?.(pointerId);
      // Contribute this line to the enclosing declaration or statement.
      } catch {
        // ignore
      }
    };

    // Update cleanupRef.current with the right-hand side value.
    cleanupRef.current = teardown;
    // Call window.addEventListener to perform this step.
    window.addEventListener('pointermove', onMove);
    // Call window.addEventListener to perform this step.
    window.addEventListener('pointerup', finish);
    // Call window.addEventListener to perform this step.
    window.addEventListener('pointercancel', finish);
  }

  /** HTML5 dragover: update drop highlight + ghost geometry for the target car row. */
  function onTrackDragOver(e: React.DragEvent<HTMLElement>, carId: string) {
    // Evaluate the condition and enter the branch when it is true.
    if (!canDrop || moving) return;
    // Call e.preventDefault to perform this step.
    e.preventDefault();
    // Call setDragOverCarId to perform this step.
    setDragOverCarId(carId);
    // Create the dragged id constant.
    const draggedId = (window as unknown as DragGlobals).__calDragId;
    // Evaluate the condition and enter the branch when it is true.
    if (!draggedId) return;
    // Create the ev constant.
    const ev = events.find((x) => x.id === draggedId);
    // Evaluate the condition and enter the branch when it is true.
    if (!ev) return;
    // Create the drop constant.
    const drop = computeDrop(
      // Contribute this line to the enclosing declaration or statement.
      e.clientX,
      // Contribute this line to the enclosing declaration or statement.
      e.currentTarget,
      // Contribute this line to the enclosing declaration or statement.
      ev,
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      from,
      // Contribute this line to the enclosing declaration or statement.
      rangeMs,
      // Reference the identifier used by the enclosing expression.
      totalMinutes
    );
    // Call setGhost to perform this step.
    setGhost({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the left field value.
      left: drop.left,
      // Provide the width field value.
      width: drop.width,
      // Provide the title field value.
      title: ev.title,
    });
  }

  /** Clear highlight/ghost when the pointer leaves this car track. */
  function onTrackDragLeave(carId: string) {
    // Call setDragOverCarId to perform this step.
    setDragOverCarId((prev) => (prev === carId ? null : prev));
    // Call setGhost to perform this step.
    setGhost((g) => (g?.carId === carId ? null : g));
  }

  /** HTML5 drop: commit a move onto this car at the drop X position. */
  function onTrackDrop(e: React.DragEvent<HTMLElement>, carId: string) {
    // Evaluate the condition and enter the branch when it is true.
    if (!canDrop || moving || !onMoveRequest) return;
    // Call e.preventDefault to perform this step.
    e.preventDefault();
    // Create the id constant.
    const id = e.dataTransfer.getData('text/calendar-event');
    // Create the ev constant.
    const ev = events.find((x) => x.id === id);
    // Call setDragOverCarId to perform this step.
    setDragOverCarId(null);
    // Call setGhost to perform this step.
    setGhost(null);
    // Continue the surrounding logic with this statement.
    (window as unknown as DragGlobals).__calDragId = undefined;
    // Evaluate the condition and enter the branch when it is true.
    if (!ev) return;
    // Create the drop constant.
    const drop = computeDrop(
      // Contribute this line to the enclosing declaration or statement.
      e.clientX,
      // Contribute this line to the enclosing declaration or statement.
      e.currentTarget,
      // Contribute this line to the enclosing declaration or statement.
      ev,
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      from,
      // Contribute this line to the enclosing declaration or statement.
      rangeMs,
      // Reference the identifier used by the enclosing expression.
      totalMinutes
    );
    // Call onMoveRequest to perform this step.
    onMoveRequest(ev, drop.start, drop.end, carId);
  }

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    dragOverCarId,
    // Contribute this line to the enclosing declaration or statement.
    ghost,
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
  };
}
