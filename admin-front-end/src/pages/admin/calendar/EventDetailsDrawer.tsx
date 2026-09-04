import { useQuery } from '@tanstack/react-query';
import { getCalendarEventDetails } from '../../../api/admin/calendar';
import { useAuth } from '../../../auth/useAuth';
import { hasPermission } from '../../../auth/permissions';
import { Drawer } from '../../../components/ui/Drawer';
import { PageLoader } from '../../../components/ui/Loading';
import { BlockedEventDetails } from './eventDetails/BlockedEventDetails';
import { ReservationEventDetails } from './eventDetails/ReservationEventDetails';
import { TaskEventDetails } from './eventDetails/TaskEventDetails';
import { useCalendarEventActions } from './eventDetails/useCalendarEventActions';

export function EventDetailsDrawer({
  eventId,
  open,
  onClose,
  onCreateTask,
  onEditTask,
  onEditBlock,
}: {
  eventId: string | null;
  open: boolean;
  onClose: () => void;
  onCreateTask?: (carId: string | null) => void;
  onEditTask?: (task: Record<string, unknown>) => void;
  onEditBlock?: (block: Record<string, unknown>, eventId: string) => void;
}) {
  const { user } = useAuth();
  const canOps = hasPermission(user, 'can_view_reservations_ops');
  const canChangeStatus = hasPermission(user, 'can_change_reservation_status');
  const canBlocks = hasPermission(user, 'can_create_calendar_blocks');
  const canTasks = hasPermission(user, 'can_create_calendar_tasks');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'calendar', 'event', eventId],
    queryFn: () => getCalendarEventDetails(eventId!),
    enabled: open && Boolean(eventId),
  });

  const reservation = data?.reservation as Record<string, unknown> | undefined;
  const task = data?.task as Record<string, unknown> | undefined;
  const block = data?.block as Record<string, unknown> | undefined;
  const actions = data?.actions as Record<string, boolean> | undefined;
  const documents = (data?.documents as Array<Record<string, unknown>>) || [];
  const auditHistory = (data?.auditHistory as Array<Record<string, unknown>>) || [];

  const {
    busy,
    markStatus,
    setTaskStatus,
    removeTask,
    removeBlock,
    cancelReservation,
    copyPhone,
  } = useCalendarEventActions({
    reservation,
    task,
    eventId,
    onClose,
  });

  const status = reservation
    ? String(reservation.status)
    : task
      ? String(task.status)
      : block
        ? String(block.status || block.meta && (block.meta as { blockType?: string }).blockType || 'blocked')
        : '';
  const urgent =
    status === 'paid' || status === 'manual_review' || data?.type === 'payment_issue';

  const carLabel = reservation
    ? String(reservation.carName || reservation.carId || '—')
    : task
      ? String(task.carId || '—')
      : block
        ? String(block.carId || '—')
        : '—';

  return (
    <Drawer open={open} onClose={onClose} title="Event details">
      {isLoading ? <PageLoader /> : null}

      {(reservation || task || block) && !isLoading ? (
        <div className="mb-4 border-b border-[var(--color-line)] pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {status ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  urgent
                    ? 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
                    : 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]'
                }`}
              >
                {status}
              </span>
            ) : null}
            <span className="font-display text-base font-semibold text-[var(--color-ink)]">
              {carLabel}
            </span>
          </div>
        </div>
      ) : null}

      {reservation ? (
        <ReservationEventDetails
          reservation={reservation}
          documents={documents}
          auditHistory={auditHistory}
          actions={actions}
          canOps={canOps}
          canChangeStatus={canChangeStatus}
          busy={busy}
          onCreateTask={onCreateTask}
          markStatus={markStatus}
          copyPhone={copyPhone}
          cancelReservation={cancelReservation}
        />
      ) : null}

      {task ? (
        <TaskEventDetails
          task={task}
          canTasks={canTasks}
          busy={busy}
          onEditTask={onEditTask}
          setTaskStatus={setTaskStatus}
          removeTask={removeTask}
        />
      ) : null}

      {block ? (
        <BlockedEventDetails
          block={block}
          eventId={eventId}
          canBlocks={canBlocks}
          busy={busy}
          onEditBlock={onEditBlock}
          removeBlock={removeBlock}
        />
      ) : null}

      {!isLoading && !reservation && !task && !block ? (
        <p className="text-sm text-[var(--color-muted)]">No details available.</p>
      ) : null}
    </Drawer>
  );
}
