/**
 * Multi-car timeline grid: rows, headers, drag/resize interactions.
 */
import { useMemo } from 'react';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  addDays,
  // Contribute this line to the enclosing declaration or statement.
  differenceInMinutes,
  // Contribute this line to the enclosing declaration or statement.
  isSameDay,
  // Contribute this line to the enclosing declaration or statement.
  startOfDay,
// Contribute this line to the enclosing declaration or statement.
} from 'date-fns';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarCar, CalendarEvent } from './calendar.types';
// Import named exports from './timeline/TimelineCarRow'.
import { TimelineCarRow } from './timeline/TimelineCarRow';
// Import named exports from './timeline/TimelineHeader'.
import { TimelineHeader } from './timeline/TimelineHeader';
// Import named exports from './timeline/TimelineSkeleton'.
import { TimelineSkeleton } from './timeline/TimelineSkeleton';
// Import named exports from './timeline/timelineLayout'.
import { nowInSofia } from './timeline/timelineLayout';
// Import named exports from './timeline/useCarColWidth'.
import { useCarColWidth } from './timeline/useCarColWidth';
// Import named exports from './timeline/useTimelineDrag'.
import { useTimelineDrag } from './timeline/useTimelineDrag';

/** Multi-car timeline grid: rows, headers, drag/resize interactions. */
export function FleetTimelineCalendar({
  // Contribute this line to the enclosing declaration or statement.
  cars,
  // Contribute this line to the enclosing declaration or statement.
  events,
  // Contribute this line to the enclosing declaration or statement.
  from,
  // Contribute this line to the enclosing declaration or statement.
  to,
  // Contribute this line to the enclosing declaration or statement.
  onEventClick,
  // Contribute this line to the enclosing declaration or statement.
  onEmptySlot,
  // Contribute this line to the enclosing declaration or statement.
  onCarLabelClick,
  // Contribute this line to the enclosing declaration or statement.
  onReservationOpen,
  // Update canDragReservations with the right-hand side value.
  canDragReservations = false,
  // Update canDragTasks with the right-hand side value.
  canDragTasks = false,
  // Update canResize with the right-hand side value.
  canResize = false,
  // Update moving with the right-hand side value.
  moving = false,
  // Update showSkeleton with the right-hand side value.
  showSkeleton = false,
  // Update selectedEventId with the right-hand side value.
  selectedEventId = null,
  // Contribute this line to the enclosing declaration or statement.
  onMoveRequest,
  // Contribute this line to the enclosing declaration or statement.
  onResizeRequest,
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
  // Provide the on event click field value.
  onEventClick: (event: CalendarEvent) => void;
  // Provide the on empty slot field value.
  onEmptySlot: (payload: { carId: string; at: Date; clientX: number; clientY: number }) => void;
  // Continue the surrounding logic with this statement.
  onCarLabelClick?: (carId: string) => void;
  // Continue the surrounding logic with this statement.
  onReservationOpen?: (reservationId: string) => void;
  // Contribute this line to the enclosing declaration or statement.
  canDragReservations?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  canDragTasks?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  canResize?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  moving?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  showSkeleton?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  selectedEventId?: string | null;
  // Continue the surrounding logic with this statement.
  onMoveRequest?: (event: CalendarEvent, start: Date, end: Date, carId: string) => void;
  // Continue the surrounding logic with this statement.
  onResizeRequest?: (event: CalendarEvent, start: Date, end: Date) => void;
// Continue the surrounding logic with this statement.
}) {
  // Create the car col constant.
  const carCol = useCarColWidth();
  // Create the total minutes constant.
  const totalMinutes = Math.max(1, differenceInMinutes(to, from));
  // Create the range ms constant.
  const rangeMs = Math.max(1, to.getTime() - from.getTime());
  // Create the is day view constant.
  const isDayView = isSameDay(from, to) || differenceInMinutes(to, from) <= 24 * 60;
  // Create the can drop constant.
  const canDrop = canDragReservations || canDragTasks;

  // Continue the surrounding logic with this statement.
  const hours: Date[] = [];
  // Iterate using the loop initializer, condition, and step.
  for (let t = from.getTime(); t < to.getTime(); t += 60 * 60 * 1000) {
    // Call hours.push to perform this step.
    hours.push(new Date(t));
  }

  // Create the day starts constant.
  const dayStarts = useMemo(() => {
    // Continue the surrounding logic with this statement.
    const days: Date[] = [];
    // Initialize the mutable d variable.
    let d = startOfDay(from);
    // Create the end constant.
    const end = to.getTime();
    // Keep looping while the condition remains true.
    while (d.getTime() < end) {
      // Call days.push to perform this step.
      days.push(d);
      // Update d with the right-hand side value.
      d = addDays(d, 1);
    }
    // Return the resulting value to the caller.
    return days;
  // Continue the surrounding logic with this statement.
  }, [from, to]);

  // Create the now constant.
  const now = nowInSofia();
  // Create the now in range constant.
  const nowInRange = now.getTime() >= from.getTime() && now.getTime() <= to.getTime();
  // Create the now pct constant.
  const nowPct = nowInRange
    // Continue the surrounding logic with this statement.
    ? Math.max(0, Math.min(100, (differenceInMinutes(now, from) / totalMinutes) * 100))
    // Contribute this line to the enclosing declaration or statement.
    : null;

  // Create the label step constant.
  const labelStep = Math.max(1, Math.ceil(hours.length / 12));

  // Destructure object properties into local variables.
  const {
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
  // Continue the surrounding logic with this statement.
  } = useTimelineDrag({
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
  });

  // Evaluate the condition and enter the branch when it is true.
  if (showSkeleton && cars.length === 0) {
    return <TimelineSkeleton />;
  }

  // Return control to the caller with the following value.
  return (
    <div
      className="max-w-full min-w-0 overflow-x-auto overflow-y-auto overscroll-x-contain rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-soft)]"
      data-testid="fleet-timeline-scroll"
    >
      <div className="min-w-[640px] sm:min-w-[900px]">
        <TimelineHeader
          hours={hours}
          labelStep={labelStep}
          isDayView={isDayView}
          from={from}
          totalMinutes={totalMinutes}
          carCol={carCol}
        />

        {cars.map((car) => (
          <TimelineCarRow
            key={car.id}
            car={car}
            events={events}
            from={from}
            rangeMs={rangeMs}
            totalMinutes={totalMinutes}
            isDayView={isDayView}
            hours={hours}
            dayStarts={dayStarts}
            nowPct={nowPct}
            ghost={ghost}
            isTarget={dragOverCarId === car.id}
            moving={moving}
            canDragReservations={canDragReservations}
            canDragTasks={canDragTasks}
            canResize={canResize}
            selectedEventId={selectedEventId}
            carCol={carCol}
            onEventClick={onEventClick}
            onEmptySlot={onEmptySlot}
            onCarLabelClick={onCarLabelClick}
            onReservationOpen={onReservationOpen}
            beginResize={beginResize}
            beginPointerMove={beginPointerMove}
            onTrackDragOver={onTrackDragOver}
            onTrackDragLeave={onTrackDragLeave}
            onTrackDrop={onTrackDrop}
          />
        ))}

        {cars.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--color-muted)]">No cars in this view</p>
        ) : null}
      </div>
    </div>
  );
}
