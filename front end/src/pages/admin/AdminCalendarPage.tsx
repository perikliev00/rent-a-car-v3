import { useEffect, useState } from 'react';
import { formatISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/permissions';
import { PageLoader } from '../../components/ui/Loading';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/toastStore';
import { ApiError } from '../../api/client';
import { moveCalendarEvent, resizeCalendarEvent } from '../../api/admin/calendar';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarToolbar } from './calendar/CalendarToolbar';
import { CalendarFilters, type CalendarPreset } from './calendar/CalendarFilters';
import { EventLegend } from './calendar/EventLegend';
import { FleetTimelineCalendar } from './calendar/FleetTimelineCalendar';
import { MonthFleetGrid } from './calendar/MonthFleetGrid';
import { DayOperationsModal } from './calendar/DayOperationsModal';
import { EventDetailsDrawer } from './calendar/EventDetailsDrawer';
import { TaskFormModal } from './calendar/TaskFormModal';
import { BlockFormModal } from './calendar/BlockFormModal';
import { ConflictWarningModal } from './calendar/ConflictWarningModal';
import { QuickCreateMenu } from './calendar/QuickCreateMenu';
import { useCalendarFilters } from './calendar/useCalendarFilters';
import { useCalendarEvents } from './calendar/useCalendarEvents';
import {
  buildRolePresetParams,
  shouldApplyRolePreset,
} from './calendar/calendarRolePreset';
import { opsReservationUrl } from './calendar/reservationDeepLink';
import type { CalendarConflict, CalendarEvent } from './calendar/calendar.types';

export function AdminCalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const canView =
    hasPermission(user, 'can_view_calendar') ||
    hasPermission(user, 'can_view_own_calendar_tasks');
  const canMove = hasPermission(user, 'can_move_calendar_reservations');
  const canResize = hasPermission(user, 'can_resize_calendar_reservations');
  const canCreateTasks = hasPermission(user, 'can_create_calendar_tasks');
  const canCreateBlocks = hasPermission(user, 'can_create_calendar_blocks');
  const canAssign = hasPermission(user, 'can_assign_calendar_staff');
  const canOverride = hasPermission(user, 'can_override_calendar_conflicts');

  const ownOnly =
    !hasPermission(user, 'can_view_calendar') &&
    hasPermission(user, 'can_view_own_calendar_tasks');

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

  const [dayDate, setDayDate] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskMode, setTaskMode] = useState<'create' | 'edit'>('create');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskDefaults, setTaskDefaults] = useState<{
    title?: string;
    taskType?: string;
    carId?: string | null;
    startsAt?: string | null;
    dueAt?: string | null;
    locationText?: string | null;
    notes?: string | null;
    assignedToUserId?: string | null;
    reservationId?: string | null;
  }>({});
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockMode, setBlockMode] = useState<'create' | 'edit'>('create');
  const [blockId, setBlockId] = useState<string | null>(null);
  const [blockDefaults, setBlockDefaults] = useState<{
    carId?: string | null;
    start?: string;
    end?: string;
    blockType?: string;
    reason?: string;
    notes?: string;
  }>({});
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    carId: string;
    at: Date;
  } | null>(null);
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    id: string;
    start: string;
    end: string;
    carId: string;
    mode: 'move' | 'resize';
  } | null>(null);
  const [pendingBlockForce, setPendingBlockForce] = useState<((force: boolean) => void) | null>(
    null
  );

  function applyPreset(preset: CalendarPreset) {
    const next = new URLSearchParams();
    next.set('view', preset.view || view);
    next.set('date', preset.date || anchor);
    if (preset.carStatus) next.set('carStatus', preset.carStatus);
    if (preset.reservationStatus) next.set('reservationStatus', preset.reservationStatus);
    if (preset.eventType) next.set('eventType', preset.eventType);
    setParams(next);
  }

  async function applyScheduleChange(payload: {
    id: string;
    start: string;
    end: string;
    carId: string;
    force?: boolean;
    mode: 'move' | 'resize';
  }) {
    setIsMoving(true);
    try {
      const fn = payload.mode === 'resize' ? resizeCalendarEvent : moveCalendarEvent;
      await fn(payload.id, {
        start: payload.start,
        end: payload.end,
        carId: payload.carId,
        force: payload.force,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      toast(payload.mode === 'resize' ? 'Reservation resized' : 'Event moved', 'success');
      setPendingMove(null);
      setConflicts([]);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CALENDAR_CONFLICT') {
        setPendingMove(payload);
        setConflicts((err.conflicts as CalendarConflict[]) || []);
        return;
      }
      toast((err as Error).message, 'error');
    } finally {
      setIsMoving(false);
    }
  }

  function openCreateTask(carId: string | null, at?: Date) {
    setTaskMode('create');
    setTaskId(null);
    setTaskDefaults({
      carId,
      startsAt: at?.toISOString(),
      dueAt: at ? new Date(at.getTime() + 3600_000).toISOString() : undefined,
    });
    setTaskOpen(true);
  }

  function openCreateBlock(carId: string | null, at?: Date) {
    setBlockMode('create');
    setBlockId(null);
    setBlockDefaults({
      carId,
      start: at?.toISOString(),
      end: at ? new Date(at.getTime() + 2 * 3600_000).toISOString() : undefined,
    });
    setBlockOpen(true);
  }

  if (!canView) {
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-[var(--color-muted)]">You cannot view the fleet calendar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCreateBlock(null)}
            >
              Block car
            </Button>
          ) : null}
          {canCreateTasks ? (
            <Button size="sm" onClick={() => openCreateTask(null)}>
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

      {data && view === 'month' ? (
        <MonthFleetGrid
          cars={data.cars}
          events={data.events}
          from={range.from}
          to={range.to}
          onDayClick={(date) => setDayDate(date)}
          onEventClick={(ev: CalendarEvent) => setEventId(ev.id)}
        />
      ) : null}

      {data && view !== 'month' ? (
        <FleetTimelineCalendar
          cars={data.cars}
          events={data.events}
          from={range.from}
          to={range.to}
          canDragReservations={canMove}
          canDragTasks={canCreateTasks}
          canResize={canResize}
          moving={isMoving}
          showSkeleton={isFetching && Boolean(data)}
          selectedEventId={eventId}
          onEventClick={(ev) => setEventId(ev.id)}
          onReservationOpen={(id) => navigate(opsReservationUrl(id))}
          onCarLabelClick={(carId) => {
            setDayDate(formatISO(range.from, { representation: 'date' }));
            if (canCreateTasks) setTaskDefaults({ carId });
          }}
          onEmptySlot={({ carId, at, clientX, clientY }) => {
            setMenu({ x: clientX, y: clientY, carId, at });
          }}
          onMoveRequest={(ev, start, end, carId) => {
            void applyScheduleChange({
              id: ev.id,
              start: start.toISOString(),
              end: end.toISOString(),
              carId,
              mode: 'move',
            });
          }}
          onResizeRequest={(ev, start, end) => {
            void applyScheduleChange({
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
        open={Boolean(menu)}
        x={menu?.x || 0}
        y={menu?.y || 0}
        canCreateBlock={canCreateBlocks}
        canCreateTask={canCreateTasks}
        onCreateTask={() => {
          if (!menu) return;
          openCreateTask(menu.carId, menu.at);
          setMenu(null);
        }}
        onCreateBlock={() => {
          if (!menu) return;
          openCreateBlock(menu.carId, menu.at);
          setMenu(null);
        }}
        onOpenDay={() => {
          if (!menu) return;
          setDayDate(formatISO(menu.at, { representation: 'date' }));
          setMenu(null);
        }}
        onClose={() => setMenu(null)}
      />

      <DayOperationsModal
        open={Boolean(dayDate)}
        date={dayDate}
        onClose={() => setDayDate(null)}
        onOpenEvent={(id) => {
          setEventId(id);
          setDayDate(null);
        }}
        onOpenReservation={(id) => navigate(opsReservationUrl(id))}
        onFreeCarAction={(carId) => {
          if (!dayDate) return;
          const at = new Date(`${dayDate}T12:00:00`);
          setMenu({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            carId,
            at,
          });
        }}
      />

      <EventDetailsDrawer
        open={Boolean(eventId)}
        eventId={eventId}
        onClose={() => setEventId(null)}
        onCreateTask={
          canCreateTasks
            ? (carId) => openCreateTask(carId)
            : undefined
        }
        onEditTask={
          canCreateTasks
            ? (task) => {
                setTaskMode('edit');
                setTaskId(String(task.id));
                setTaskDefaults({
                  title: String(task.title || ''),
                  taskType: String(task.taskType || 'pickup'),
                  carId: task.carId ? String(task.carId) : null,
                  startsAt: task.startsAt ? String(task.startsAt) : null,
                  dueAt: task.dueAt ? String(task.dueAt) : null,
                  locationText: task.locationText ? String(task.locationText) : null,
                  notes: task.notes ? String(task.notes) : null,
                  assignedToUserId: task.assignedToUserId
                    ? String(task.assignedToUserId)
                    : null,
                  reservationId: task.reservationId ? String(task.reservationId) : null,
                });
                setTaskOpen(true);
              }
            : undefined
        }
        onEditBlock={
          canCreateBlocks
            ? (block, eid) => {
                const rawId = eid.startsWith('blocked:') ? eid.slice('blocked:'.length) : eid;
                setBlockMode('edit');
                setBlockId(rawId);
                const meta = (block.meta || {}) as { blockType?: string; notes?: string };
                setBlockDefaults({
                  carId: block.carId ? String(block.carId) : null,
                  start: block.start ? String(block.start) : undefined,
                  end: block.end ? String(block.end) : undefined,
                  blockType: meta.blockType || String(block.status || 'manual'),
                  reason: block.title ? String(block.title) : '',
                  notes: meta.notes || '',
                });
                setBlockOpen(true);
              }
            : undefined
        }
      />

      <TaskFormModal
        open={taskOpen}
        mode={taskMode}
        taskId={taskId}
        cars={cars}
        defaults={taskDefaults}
        canAssign={canAssign}
        onClose={() => setTaskOpen(false)}
      />

      <BlockFormModal
        open={blockOpen}
        mode={blockMode}
        blockId={blockId}
        cars={cars}
        defaults={blockDefaults}
        onClose={() => setBlockOpen(false)}
        onConflict={(c, retry) => {
          setConflicts(c);
          setPendingBlockForce(() => retry);
        }}
      />

      <ConflictWarningModal
        open={conflicts.length > 0}
        conflicts={conflicts}
        canOverride={canOverride}
        onClose={() => {
          setConflicts([]);
          setPendingMove(null);
          setPendingBlockForce(null);
        }}
        onForce={() => {
          if (pendingBlockForce) {
            pendingBlockForce(true);
            setPendingBlockForce(null);
            setConflicts([]);
            return;
          }
          if (!pendingMove) return;
          void applyScheduleChange({ ...pendingMove, force: true });
        }}
      />
    </div>
  );
}
