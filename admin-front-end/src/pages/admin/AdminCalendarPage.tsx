/**
 * Fleet calendar page wiring filters, views, modals, and permissions.
 */
import { useEffect, useState } from 'react';
// Import named exports from 'date-fns'.
import { formatISO } from 'date-fns';
// Import named exports from 'react-router-dom'.
import { useNavigate } from 'react-router-dom';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from './calendar/CalendarToolbar'.
import { CalendarToolbar } from './calendar/CalendarToolbar';
// Import named exports from './calendar/CalendarFilters'.
import { CalendarFilters, type CalendarPreset } from './calendar/CalendarFilters';
// Import named exports from './calendar/EventLegend'.
import { EventLegend } from './calendar/EventLegend';
// Import named exports from './calendar/FleetTimelineCalendar'.
import { FleetTimelineCalendar } from './calendar/FleetTimelineCalendar';
// Import named exports from './calendar/MonthFleetGrid'.
import { MonthFleetGrid } from './calendar/MonthFleetGrid';
// Import named exports from './calendar/DayAgendaList'.
import { DayAgendaList } from './calendar/DayAgendaList';
// Import named exports from './calendar/DayOperationsModal'.
import { DayOperationsModal } from './calendar/DayOperationsModal';
// Import named exports from './calendar/EventDetailsDrawer'.
import { EventDetailsDrawer } from './calendar/EventDetailsDrawer';
// Import named exports from './calendar/TaskFormModal'.
import { TaskFormModal } from './calendar/TaskFormModal';
// Import named exports from './calendar/BlockFormModal'.
import { BlockFormModal } from './calendar/BlockFormModal';
// Import named exports from './calendar/ConflictWarningModal'.
import { ConflictWarningModal } from './calendar/ConflictWarningModal';
// Import named exports from './calendar/QuickCreateMenu'.
import { QuickCreateMenu } from './calendar/QuickCreateMenu';
// Import named exports from './calendar/useCalendarFilters'.
import { useCalendarFilters } from './calendar/useCalendarFilters';
// Import named exports from './calendar/useCalendarEvents'.
import { useCalendarEvents } from './calendar/useCalendarEvents';
// Import named exports from './calendar/useCalendarPermissions'.
import { useCalendarPermissions } from './calendar/useCalendarPermissions';
// Import named exports from './calendar/useCalendarModals'.
import { useCalendarModals } from './calendar/useCalendarModals';
// Import named exports from './calendar/useCalendarSchedule'.
import { useCalendarSchedule } from './calendar/useCalendarSchedule';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  buildRolePresetParams,
  // Contribute this line to the enclosing declaration or statement.
  shouldApplyRolePreset,
// Contribute this line to the enclosing declaration or statement.
} from './calendar/calendarRolePreset';
// Import named exports from './calendar/reservationDeepLink'.
import { opsReservationUrl } from './calendar/reservationDeepLink';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarEvent } from './calendar/calendar.types';

/** Use Prefer Agenda Default. */
function usePreferAgendaDefault() {
  // Destructure array values into local variables.
  const [preferAgenda, setPreferAgenda] = useState(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    // Return the resulting value to the caller.
    return window.matchMedia('(max-width: 767px)').matches;
  });
  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (typeof window.matchMedia !== 'function') return;
    // Create the mq constant.
    const mq = window.matchMedia('(max-width: 767px)');
    // Create the on change constant.
    const onChange = () => {
      // Evaluate the condition and enter the branch when it is true.
      if (mq.matches) setPreferAgenda(true);
    };
    // Call mq.addEventListener to perform this step.
    mq.addEventListener('change', onChange);
    // Return the resulting value to the caller.
    return () => mq.removeEventListener('change', onChange);
  // Continue the surrounding logic with this statement.
  }, []);
  // Return the resulting value to the caller.
  return [preferAgenda, setPreferAgenda] as const;
}

/** Fleet calendar page wiring filters, views, modals, and permissions. */
export function AdminCalendarPage() {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Create the navigate constant.
  const navigate = useNavigate();
  // Destructure array values into local variables.
  const [preferAgenda, setPreferAgenda] = usePreferAgendaDefault();
  // Destructure object properties into local variables.
  const {
    // Contribute this line to the enclosing declaration or statement.
    view,
    // Contribute this line to the enclosing declaration or statement.
    anchor,
    // Contribute this line to the enclosing declaration or statement.
    filters,
    // Contribute this line to the enclosing declaration or statement.
    range,
    // Contribute this line to the enclosing declaration or statement.
    setView,
    // Contribute this line to the enclosing declaration or statement.
    setAnchor,
    // Contribute this line to the enclosing declaration or statement.
    shiftByView,
    // Contribute this line to the enclosing declaration or statement.
    setFilter,
    // Contribute this line to the enclosing declaration or statement.
    clearFilters,
    // Contribute this line to the enclosing declaration or statement.
    setParams,
    // Contribute this line to the enclosing declaration or statement.
    params,
  // Continue the surrounding logic with this statement.
  } = useCalendarFilters();

  // Destructure object properties into local variables.
  const {
    // Contribute this line to the enclosing declaration or statement.
    canView,
    // Contribute this line to the enclosing declaration or statement.
    canMove,
    // Contribute this line to the enclosing declaration or statement.
    canResize,
    // Contribute this line to the enclosing declaration or statement.
    canCreateTasks,
    // Contribute this line to the enclosing declaration or statement.
    canCreateBlocks,
    // Contribute this line to the enclosing declaration or statement.
    canAssign,
    // Contribute this line to the enclosing declaration or statement.
    canOverride,
    // Contribute this line to the enclosing declaration or statement.
    ownOnly,
  // Continue the surrounding logic with this statement.
  } = useCalendarPermissions(user);

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!user || !canView) return;
    // Evaluate the condition and enter the branch when it is true.
    if (!shouldApplyRolePreset(params)) return;
    // Call setParams to perform this step.
    setParams(buildRolePresetParams(user), { replace: true });
  // Continue the surrounding logic with this statement.
  }, [user, canView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Destructure object properties into local variables.
  const { data, isLoading, isFetching } = useCalendarEvents({
    // Provide the from field value.
    from: range.from,
    // Provide the to field value.
    to: range.to,
    // Provide the density field value.
    density: range.density,
    // Contribute this line to the enclosing declaration or statement.
    filters,
    // Provide the enabled field value.
    enabled: canView,
  });

  // Create the cars constant.
  const cars = data?.cars || [];
  // Create the modals constant.
  const modals = useCalendarModals();
  // Create the schedule constant.
  const schedule = useCalendarSchedule();

  /** Apply Preset. */
  function applyPreset(preset: CalendarPreset) {
    // Create the next constant.
    const next = new URLSearchParams();
    // Call next.set to perform this step.
    next.set('view', preset.view || view);
    // Call next.set to perform this step.
    next.set('date', preset.date || anchor);
    // Evaluate the condition and enter the branch when it is true.
    if (preset.carStatus) next.set('carStatus', preset.carStatus);
    // Evaluate the condition and enter the branch when it is true.
    if (preset.reservationStatus) next.set('reservationStatus', preset.reservationStatus);
    // Evaluate the condition and enter the branch when it is true.
    if (preset.eventType) next.set('eventType', preset.eventType);
    // Call setParams to perform this step.
    setParams(next);
  }

  // Create the show agenda constant.
  const showAgenda = preferAgenda && view !== 'month';

  // Evaluate the condition and enter the branch when it is true.
  if (!canView) {
    // Return control to the caller with the following value.
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-[var(--color-muted)]">You cannot view the fleet calendar.</p>
      </div>
    );
  }

  // Return control to the caller with the following value.
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
