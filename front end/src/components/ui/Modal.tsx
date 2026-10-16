/**
 * Centered dialog with backdrop click + Escape to close.
 * Uses {@link useOverlayLock} for body scroll lock and focus trapping.
 */
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { useOverlayLock } from './useOverlayLock';

/**
 * Centered modal dialog overlay.
 *
 * @param props.open - When false, render nothing.
 * @param props.onClose - Called on backdrop click, Escape, or the Close control.
 * @param props.title - Optional sticky header title (also wires `aria-labelledby`).
 * @param props.children - Dialog body content.
 * @param props.wide - When true, uses a wider max-width (`max-w-4xl`).
 * @returns The modal portal-like overlay, or `null` when closed.
 * @remarks Side effects: scroll lock + focus trap via {@link useOverlayLock}; Escape listener while open.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayLock(open, panelRef);

  useEffect(() => {
    if (!open) return;
    // Escape closes the dialog (in addition to focus-trap Tab handling).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

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
