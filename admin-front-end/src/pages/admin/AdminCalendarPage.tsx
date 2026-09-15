import { useEffect, useState } from 'react';
import { formatISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { PageLoader } from '../../components/ui/Loading';
import { Button } from '../../components/ui/Button';
import { CalendarToolbar } from './calendar/CalendarToolbar';
import { CalendarFilters, type CalendarPreset } from './calendar/CalendarFilters';
import { EventLegend } from './calendar/EventLegend';
import { FleetTimelineCalendar } from './calendar/FleetTimelineCalendar';
import { MonthFleetGrid } from './calendar/MonthFleetGrid';
import { DayAgendaList } from './calendar/DayAgendaList';
import { DayOperationsModal } from './calendar/DayOperationsModal';
import { EventDetailsDrawer } from './calendar/EventDetailsDrawer';
import { TaskFormModal } from './calendar/TaskFormModal';
import { BlockFormModal } from './calendar/BlockFormModal';
import { ConflictWarningModal } from './calendar/ConflictWarningModal';
import { QuickCreateMenu } from './calendar/QuickCreateMenu';
import { useCalendarFilters } from './calendar/useCalendarFilters';
import { useCalendarEvents } from './calendar/useCalendarEvents';
import { useCalendarPermissions } from './calendar/useCalendarPermissions';
import { useCalendarModals } from './calendar/useCalendarModals';
import { useCalendarSchedule } from './calendar/useCalendarSchedule';
import {
  buildRolePresetParams,
  shouldApplyRolePreset,
} from './calendar/calendarRolePreset';
import { opsReservationUrl } from './calendar/reservationDeepLink';
import type { CalendarEvent } from './calendar/calendar.types';

function usePreferAgendaDefault() {
  const [preferAgenda, setPreferAgenda] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => {
      if (mq.matches) setPreferAgenda(true);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return [preferAgenda, setPreferAgenda] as const;
}

export function AdminCalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [preferAgenda, setPreferAgenda] = usePreferAgendaDefault();
  const {
    view,
    anchor,
    filters,
    range,
    setView,
    setAnchor,
    shiftByView,
    setFilter,
    clearFilters,
    setParams,
    params,
  } = useCalendarFilters();

  const {
    canView,
    canMove,
    canResize,
    canCreateTasks,
    canCreateBlocks,
    canAssign,
    canOverride,
    ownOnly,
  } = useCalendarPermissions(user);

  useEffect(() => {
    if (!user || !canView) return;
    if (!shouldApplyRolePreset(params)) return;
    setParams(buildRolePresetParams(user), { replace: true });
  }, [user, canView]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isFetching } = useCalendarEvents({
    from: range.from,
    to: range.to,
    density: range.density,
    filters,
    enabled: canView,
  });

  const cars = data?.cars || [];
  const modals = useCalendarModals();
  const schedule = useCalendarSchedule();

  function applyPreset(preset: CalendarPreset) {
    const next = new URLSearchParams();
    next.set('view', preset.view || view);
    next.set('date', preset.date || anchor);
    if (preset.carStatus) next.set('carStatus', preset.carStatus);
    if (preset.reservationStatus) next.set('reservationStatus', preset.reservationStatus);
    if (preset.eventType) next.set('eventType', preset.eventType);
    setParams(next);
  }

  const showAgenda = preferAgenda && view !== 'month';

  if (!canView) {
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-[var(--color-muted)]">You cannot view the fleet calendar.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Fleet calendar
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">
            {ownOnly
              ? 'Your assigned tasks and related cars'
              : 'Dispatch board for cars, reservations, and ops signals'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateBlocks ? (
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => modals.openCreateBlock(null)}>
              Block car
            </Button>
          ) : null}
          {canCreateTasks ? (
            <Button size="sm" className="min-h-11" onClick={() => modals.openCreateTask(null)}>
              Create task
            </Button>
          ) : null}
        </div>
      </div>

      <CalendarToolbar
        view={view}
        anchor={anchor}
        from={range.from}
        to={range.to}
        onViewChange={setView}
        onPrev={() => shiftByView(-1)}
        onNext={() => shiftByView(1)}
        onToday={() => setAnchor(formatISO(new Date(), { representation: 'date' }))}
        onAnchorChange={setAnchor}
        preferAgenda={preferAgenda}
        onPreferAgendaChange={setPreferAgenda}
      />

      <EventLegend />

      {!ownOnly ? (
        <CalendarFilters
          filters={filters}
          view={view}
          onChange={setFilter}
          onClear={clearFilters}
          onApplyPreset={applyPreset}
        />
      ) : null}

      {isLoading && !data ? <PageLoader /> : null}

      {data && showAgenda ? (
        <DayAgendaList
          cars={data.cars}
          events={data.events}
          day={range.from}
          onEventClick={(ev: CalendarEvent) => modals.setEventId(ev.id)}
          onCarClick={(carId) => {
            modals.setDayDate(formatISO(range.from, { representation: 'date' }));
            if (canCreateTasks) modals.setTaskDefaults({ carId });
          }}
        />
      ) : null}

      {data && view === 'month' && !showAgenda ? (
        <MonthFleetGrid
          cars={data.cars}
          events={data.events}
          from={range.from}
          to={range.to}
          onDayClick={(date) => modals.setDayDate(date)}
          onEventClick={(ev: CalendarEvent) => modals.setEventId(ev.id)}
        />
      ) : null}

      {data && view !== 'month' && !showAgenda ? (
        <FleetTimelineCalendar
          cars={data.cars}
          events={data.events}
          from={range.from}
          to={range.to}
          canDragReservations={canMove}
          canDragTasks={canCreateTasks}
          canResize={canResize}
          moving={schedule.isMoving}
          showSkeleton={isFetching && Boolean(data)}
          selectedEventId={modals.eventId}
          onEventClick={(ev) => modals.setEventId(ev.id)}
          onReservationOpen={(id) => navigate(opsReservationUrl(id))}
          onCarLabelClick={(carId) => {
            modals.setDayDate(formatISO(range.from, { representation: 'date' }));
            if (canCreateTasks) modals.setTaskDefaults({ carId });
          }}
          onEmptySlot={({ carId, at, clientX, clientY }) => {
            modals.setMenu({ x: clientX, y: clientY, carId, at });
          }}
          onMoveRequest={(ev, start, end, carId) => {
            void schedule.applyScheduleChange({
              id: ev.id,
              start: start.toISOString(),
              end: end.toISOString(),
              carId,
              mode: 'move',
            });
          }}
          onResizeRequest={(ev, start, end) => {
            void schedule.applyScheduleChange({
              id: ev.id,
              start: start.toISOString(),
              end: end.toISOString(),
              carId: ev.carId || '',
              mode: 'resize',
            });
          }}
        />
      ) : null}

      <QuickCreateMenu
        open={Boolean(modals.menu)}
        x={modals.menu?.x || 0}
        y={modals.menu?.y || 0}
        canCreateBlock={canCreateBlocks}
        canCreateTask={canCreateTasks}
        onCreateTask={modals.createTaskFromMenu}
        onCreateBlock={modals.createBlockFromMenu}
        onOpenDay={modals.openDayFromMenu}
        onClose={() => modals.setMenu(null)}
      />

      <DayOperationsModal
        open={Boolean(modals.dayDate)}
        date={modals.dayDate}
        onClose={() => modals.setDayDate(null)}
        onOpenEvent={modals.openEventFromDay}
        onOpenReservation={(id) => navigate(opsReservationUrl(id))}
        onFreeCarAction={modals.openMenuFromDay}
      />

      <EventDetailsDrawer
        open={Boolean(modals.eventId)}
        eventId={modals.eventId}
        onClose={() => modals.setEventId(null)}
        onCreateTask={canCreateTasks ? (carId) => modals.openCreateTask(carId) : undefined}
        onEditTask={canCreateTasks ? modals.editTask : undefined}
        onEditBlock={canCreateBlocks ? modals.editBlock : undefined}
      />

      <TaskFormModal
        open={modals.taskOpen}
        mode={modals.taskMode}
        taskId={modals.taskId}
        cars={cars}
        defaults={modals.taskDefaults}
        canAssign={canAssign}
        onClose={() => modals.setTaskOpen(false)}
      />

      <BlockFormModal
        open={modals.blockOpen}
        mode={modals.blockMode}
        blockId={modals.blockId}
        cars={cars}
        defaults={modals.blockDefaults}
        onClose={() => modals.setBlockOpen(false)}
        onConflict={schedule.onBlockConflict}
      />

      <ConflictWarningModal
        open={schedule.conflicts.length > 0}
        conflicts={schedule.conflicts}
        canOverride={canOverride}
        onClose={schedule.clearConflicts}
        onForce={schedule.forceOverride}
      />
    </div>
  );
}
