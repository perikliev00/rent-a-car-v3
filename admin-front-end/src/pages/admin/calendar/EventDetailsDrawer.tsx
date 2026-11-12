/**
 * Drawer that loads and routes event details by event kind.
 */
import { useQuery } from '@tanstack/react-query';
// Import named exports from '../../../api/admin/calendar'.
import { getCalendarEventDetails } from '../../../api/admin/calendar';
// Import named exports from '../../../auth/useAuth'.
import { useAuth } from '../../../auth/useAuth';
// Import named exports from '../../../auth/permissions'.
import { hasPermission } from '../../../auth/permissions';
// Import named exports from '../../../components/ui/Drawer'.
import { Drawer } from '../../../components/ui/Drawer';
// Import named exports from '../../../components/ui/Loading'.
import { PageLoader } from '../../../components/ui/Loading';
// Import named exports from './eventDetails/BlockedEventDetails'.
import { BlockedEventDetails } from './eventDetails/BlockedEventDetails';
// Import named exports from './eventDetails/ReservationEventDetails'.
import { ReservationEventDetails } from './eventDetails/ReservationEventDetails';
// Import named exports from './eventDetails/TaskEventDetails'.
import { TaskEventDetails } from './eventDetails/TaskEventDetails';
// Import named exports from './eventDetails/useCalendarEventActions'.
import { useCalendarEventActions } from './eventDetails/useCalendarEventActions';

/** Drawer that loads and routes event details by event kind. */
export function EventDetailsDrawer({
  // Contribute this line to the enclosing declaration or statement.
  eventId,
  // Contribute this line to the enclosing declaration or statement.
  open,
  // Contribute this line to the enclosing declaration or statement.
  onClose,
  // Contribute this line to the enclosing declaration or statement.
  onCreateTask,
  // Contribute this line to the enclosing declaration or statement.
  onEditTask,
  // Contribute this line to the enclosing declaration or statement.
  onEditBlock,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the event id field value.
  eventId: string | null;
  // Provide the open field value.
  open: boolean;
  // Provide the on close field value.
  onClose: () => void;
  // Continue the surrounding logic with this statement.
  onCreateTask?: (carId: string | null) => void;
  // Continue the surrounding logic with this statement.
  onEditTask?: (task: Record<string, unknown>) => void;
  // Continue the surrounding logic with this statement.
  onEditBlock?: (block: Record<string, unknown>, eventId: string) => void;
// Continue the surrounding logic with this statement.
}) {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Create the can ops constant.
  const canOps = hasPermission(user, 'can_view_reservations_ops');
  // Create the can change status constant.
  const canChangeStatus = hasPermission(user, 'can_change_reservation_status');
  // Create the can blocks constant.
  const canBlocks = hasPermission(user, 'can_create_calendar_blocks');
  // Create the can tasks constant.
  const canTasks = hasPermission(user, 'can_create_calendar_tasks');

  // Destructure object properties into local variables.
  const { data, isLoading } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'calendar', 'event', eventId],
    // Provide the query fn field value.
    queryFn: () => getCalendarEventDetails(eventId!),
    // Provide the enabled field value.
    enabled: open && Boolean(eventId),
  });

  // Create the reservation constant.
  const reservation = data?.reservation as Record<string, unknown> | undefined;
  // Create the task constant.
  const task = data?.task as Record<string, unknown> | undefined;
  // Create the block constant.
  const block = data?.block as Record<string, unknown> | undefined;
  // Create the actions constant.
  const actions = data?.actions as Record<string, boolean> | undefined;
  // Create the documents constant.
  const documents = (data?.documents as Array<Record<string, unknown>>) || [];
  // Create the audit history constant.
  const auditHistory = (data?.auditHistory as Array<Record<string, unknown>>) || [];

  // Destructure object properties into local variables.
  const {
    // Contribute this line to the enclosing declaration or statement.
    busy,
    // Contribute this line to the enclosing declaration or statement.
    markStatus,
    // Contribute this line to the enclosing declaration or statement.
    setTaskStatus,
    // Contribute this line to the enclosing declaration or statement.
    removeTask,
    // Contribute this line to the enclosing declaration or statement.
    removeBlock,
    // Contribute this line to the enclosing declaration or statement.
    cancelReservation,
    // Contribute this line to the enclosing declaration or statement.
    copyPhone,
  // Continue the surrounding logic with this statement.
  } = useCalendarEventActions({
    // Contribute this line to the enclosing declaration or statement.
    reservation,
    // Contribute this line to the enclosing declaration or statement.
    task,
    // Contribute this line to the enclosing declaration or statement.
    eventId,
    // Contribute this line to the enclosing declaration or statement.
    onClose,
  });

  // Create the status constant.
  const status = reservation
    // Continue the surrounding logic with this statement.
    ? String(reservation.status)
    // Contribute this line to the enclosing declaration or statement.
    : task
      // Continue the surrounding logic with this statement.
      ? String(task.status)
      // Contribute this line to the enclosing declaration or statement.
      : block
        // Continue the surrounding logic with this statement.
        ? String(block.status || block.meta && (block.meta as { blockType?: string }).blockType || 'blocked')
        // Contribute this line to the enclosing declaration or statement.
        : '';
  // Create the urgent constant.
  const urgent =
    // Update status with the right-hand side value.
    status === 'paid' || status === 'manual_review' || data?.type === 'payment_issue';

  // Create the car label constant.
  const carLabel = reservation
    // Continue the surrounding logic with this statement.
    ? String(reservation.carName || reservation.carId || '—')
    // Contribute this line to the enclosing declaration or statement.
    : task
      // Continue the surrounding logic with this statement.
      ? String(task.carId || '—')
      // Contribute this line to the enclosing declaration or statement.
      : block
        // Continue the surrounding logic with this statement.
        ? String(block.carId || '—')
        // Contribute this line to the enclosing declaration or statement.
        : '—';

  // Return control to the caller with the following value.
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
