/**
 * Side drawer overlay with escape-to-close and scroll/focus lock.
 */
import type { ReactNode } from 'react';
// Import named exports from 'react'.
import { useEffect, useId, useRef } from 'react';
// Import named exports from './useOverlayLock'.
import { useOverlayLock } from './useOverlayLock';

/**
 * Slide-in drawer panel (left or right) with backdrop dismiss and Escape.
 *
 * @param open - Whether the drawer is visible
 * @param onClose - Called on backdrop click, Escape, or Close button
 * @param title - Header title (falls back to “Details”)
 * @param children - Scrollable drawer body
 * @param side - Which edge the panel anchors to (default right)
 */
export function Drawer({
  // Contribute this line to the enclosing declaration or statement.
  open,
  // Contribute this line to the enclosing declaration or statement.
  onClose,
  // Contribute this line to the enclosing declaration or statement.
  title,
  // Contribute this line to the enclosing declaration or statement.
  children,
  // Update side with the right-hand side value.
  side = 'right',
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the open field value.
  open: boolean;
  // Provide the on close field value.
  onClose: () => void;
  // Contribute this line to the enclosing declaration or statement.
  title?: string;
  // Provide the children field value.
  children: ReactNode;
  // Contribute this line to the enclosing declaration or statement.
  side?: 'left' | 'right';
// Continue the surrounding logic with this statement.
}) {
  // Create the title id constant.
  const titleId = useId();
  // Create the panel ref constant.
  const panelRef = useRef<HTMLElement>(null);
  // Call useOverlayLock to perform this step.
  useOverlayLock(open, panelRef);

  // Escape closes while open.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;
    // Create the on key constant.
    const onKey = (e: KeyboardEvent) => {
      // Evaluate the condition and enter the branch when it is true.
      if (e.key === 'Escape') onClose();
    };
    // Call window.addEventListener to perform this step.
    window.addEventListener('keydown', onKey);
    // Return the resulting value to the caller.
    return () => window.removeEventListener('keydown', onKey);
  // Continue the surrounding logic with this statement.
  }, [open, onClose]);

  // Evaluate the condition and enter the branch when it is true.
  if (!open) return null;

  // Border + slide animation depend on which edge is used.
  const sideClass =
    // Update side with the right-hand side value.
    side === 'left'
      // Continue the surrounding logic with this statement.
      ? 'justify-start border-r animate-[lux-drawer_0.35s_var(--ease-out)_both]'
      // Continue the surrounding logic with this statement.
      : 'justify-end border-l animate-[lux-drawer_0.35s_var(--ease-out)_both]';

  // Return control to the caller with the following value.
  return (
    <div className={`fixed inset-0 z-50 flex ${side === 'left' ? 'justify-start' : 'justify-end'}`}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40 animate-lux-fade"
        aria-label="Close"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 flex h-full w-full max-w-md flex-col border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-xl outline-none ${sideClass}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
          <h2
            id={titleId}
            className="min-w-0 font-display text-lg font-semibold text-[var(--color-ink)]"
          >
            {title || 'Details'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
      </aside>
    </div>
  );
}
