import { useEffect, useRef } from 'react';

export function QuickCreateMenu({
  open,
  x,
  y,
  canCreateBlock,
  canCreateTask,
  onCreateTask,
  onCreateBlock,
  onOpenDay,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  canCreateBlock: boolean;
  canCreateTask: boolean;
  onCreateTask: () => void;
  onCreateBlock: () => void;
  onOpenDay: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const item =
    'block w-full px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface)]';

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
