/**
 * Context menu to create block/task/reservation from a slot.
 */
import { useEffect, useRef } from 'react';

/**
 * Floating context menu for creating a task/block or opening day ops at (x, y).
 * Dismisses on Escape or outside click.
 *
 * @param open - Menu visibility
 * @param x / y - Viewport coordinates for positioning
 * @param canCreateBlock / canCreateTask - RBAC gates for menu items
 * @param onCreateTask / onCreateBlock / onOpenDay - Menu actions
 * @param onClose - Dismiss handler
 */
export function QuickCreateMenu({
  // Contribute this line to the enclosing declaration or statement.
  open,
  // Contribute this line to the enclosing declaration or statement.
  x,
  // Contribute this line to the enclosing declaration or statement.
  y,
  // Contribute this line to the enclosing declaration or statement.
  canCreateBlock,
  // Contribute this line to the enclosing declaration or statement.
  canCreateTask,
  // Contribute this line to the enclosing declaration or statement.
  onCreateTask,
  // Contribute this line to the enclosing declaration or statement.
  onCreateBlock,
  // Contribute this line to the enclosing declaration or statement.
  onOpenDay,
  // Contribute this line to the enclosing declaration or statement.
  onClose,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the open field value.
  open: boolean;
  // Provide the x field value.
  x: number;
  // Provide the y field value.
  y: number;
  // Provide the can create block field value.
  canCreateBlock: boolean;
  // Provide the can create task field value.
  canCreateTask: boolean;
  // Provide the on create task field value.
  onCreateTask: () => void;
  // Provide the on create block field value.
  onCreateBlock: () => void;
  // Provide the on open day field value.
  onOpenDay: () => void;
  // Provide the on close field value.
  onClose: () => void;
// Continue the surrounding logic with this statement.
}) {
  // Create the ref constant.
  const ref = useRef<HTMLDivElement>(null);

  // Escape + outside mousedown while open.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;
    // Create the on key constant.
    const onKey = (e: KeyboardEvent) => {
      // Evaluate the condition and enter the branch when it is true.
      if (e.key === 'Escape') onClose();
    };
    // Create the on down constant.
    const onDown = (e: MouseEvent) => {
      // Evaluate the condition and enter the branch when it is true.
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Call window.addEventListener to perform this step.
    window.addEventListener('keydown', onKey);
    // Call window.addEventListener to perform this step.
    window.addEventListener('mousedown', onDown);
    // Return the resulting value to the caller.
    return () => {
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('keydown', onKey);
      // Call window.removeEventListener to perform this step.
      window.removeEventListener('mousedown', onDown);
    };
  // Continue the surrounding logic with this statement.
  }, [open, onClose]);

  // Evaluate the condition and enter the branch when it is true.
  if (!open) return null;

  // Create the item constant.
  const item =
    // Continue the surrounding logic with this statement.
    'block w-full px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface)]';

  // Return control to the caller with the following value.
  return (
    <div
      ref={ref}
      data-testid="quick-create-menu"
      className="fixed z-[60] min-w-[180px] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-lift)]"
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 200) }}
      role="menu"
    >
      {canCreateTask ? (
        <button type="button" className={item} role="menuitem" onClick={onCreateTask}>
          Create task
        </button>
      ) : null}
      {canCreateBlock ? (
        <button type="button" className={item} role="menuitem" onClick={onCreateBlock}>
          Block car
        </button>
      ) : null}
      <button type="button" className={item} role="menuitem" onClick={onOpenDay}>
        Open day ops
      </button>
      <button
        type="button"
        className={`${item} border-t border-[var(--color-line)] text-[var(--color-muted)]`}
        role="menuitem"
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  );
}
