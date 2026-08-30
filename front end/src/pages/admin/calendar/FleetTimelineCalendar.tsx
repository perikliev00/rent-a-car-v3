import { useMemo } from 'react';
import {
  addDays,
  differenceInMinutes,
  isSameDay,
  startOfDay,
} from 'date-fns';
import type { CalendarCar, CalendarEvent } from './calendar.types';
import { TimelineCarRow } from './timeline/TimelineCarRow';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineSkeleton } from './timeline/TimelineSkeleton';
import { nowInSofia } from './timeline/timelineLayout';
import { useTimelineDrag } from './timeline/useTimelineDrag';

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
  const canDrop = canDragReservations || canDragTasks;

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

  const labelStep = Math.max(1, Math.ceil(hours.length / 12));

  const {
    dragOverCarId,
    ghost,
    beginResize,
    beginPointerMove,
    onTrackDragOver,
    onTrackDragLeave,
    onTrackDrop,
  } = useTimelineDrag({
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
  });

  if (showSkeleton && cars.length === 0) {
    return <TimelineSkeleton />;
  }

  return (
    <div className="overflow-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-soft)]">
      <div className="min-w-[900px]">
        <TimelineHeader
          hours={hours}
          labelStep={labelStep}
          isDayView={isDayView}
          from={from}
          totalMinutes={totalMinutes}
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
