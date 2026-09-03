import type { ReactNode } from 'react';
import { useEffect, useId } from 'react';

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

  useEffect(() => {
    if (!open) return;
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] shadow-xl ${
          wide ? 'max-w-4xl' : 'max-w-lg'
        }`}
      >
        {title ? (
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
            <h2
              id={titleId}
              className="font-display text-lg font-semibold text-[var(--color-ink)]"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
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
