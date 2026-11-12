/**
 * Side drawer overlay (mobile nav). Shares scroll-lock/focus behavior with Modal.
 */
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { useOverlayLock } from './useOverlayLock';

/**
 * Side drawer overlay for mobile navigation and detail panels.
 *
 * @param props.open - When false, render nothing.
 * @param props.onClose - Called on backdrop click, Escape, or the Close control.
 * @param props.title - Header title; falls back to `"Details"` when omitted.
 * @param props.children - Drawer body content.
 * @param props.side - Which edge the panel anchors to (`left` | `right`, default `right`).
 * @returns The drawer overlay, or `null` when closed.
 * @remarks Side effects: scroll lock + focus trap via {@link useOverlayLock}; Escape listener while open.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: 'left' | 'right';
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  useOverlayLock(open, panelRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Border + slide-in animation differ by anchor edge.
  const sideClass =
    side === 'left'
      ? 'justify-start border-r animate-[lux-drawer_0.35s_var(--ease-out)_both]'
      : 'justify-end border-l animate-[lux-drawer_0.35s_var(--ease-out)_both]';

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
