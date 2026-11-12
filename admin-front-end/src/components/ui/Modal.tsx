/**
 * Centered dialog overlay with escape-to-close and scroll/focus lock.
 */
import type { ReactNode } from 'react';
// Import named exports from 'react'.
import { useEffect, useId, useRef } from 'react';
// Import named exports from './useOverlayLock'.
import { useOverlayLock } from './useOverlayLock';

/**
 * Modal dialog that locks body scroll/focus while open.
 *
 * @param open - Whether the dialog is visible
 * @param onClose - Called on backdrop click, Escape, or Close button
 * @param title - Optional sticky header title (also wired to aria-labelledby)
 * @param children - Dialog body
 * @param wide - When true, uses `max-w-4xl` instead of `max-w-lg`
 */
export function Modal({
  // Contribute this line to the enclosing declaration or statement.
  open,
  // Contribute this line to the enclosing declaration or statement.
  onClose,
  // Contribute this line to the enclosing declaration or statement.
  title,
  // Contribute this line to the enclosing declaration or statement.
  children,
  // Update wide with the right-hand side value.
  wide = false,
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
  wide?: boolean;
// Continue the surrounding logic with this statement.
}) {
  // Create the title id constant.
  const titleId = useId();
  // Create the panel ref constant.
  const panelRef = useRef<HTMLDivElement>(null);
  // Call useOverlayLock to perform this step.
  useOverlayLock(open, panelRef);

  // Escape closes the dialog while it is open.
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

  // Backdrop + panel; backdrop click dismisses.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative z-10 max-h-[min(90vh,100dvh)] w-full overflow-y-auto overscroll-contain rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-xl outline-none ${
          wide ? 'max-w-4xl' : 'max-w-lg'
        }`}
      >
        {title ? (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-5 py-4">
            <h2
              id={titleId}
              className="min-w-0 pr-2 font-display text-lg font-semibold text-[var(--color-ink)]"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
            >
              Close
            </button>
          </div>
        ) : null}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
