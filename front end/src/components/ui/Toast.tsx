/**
 * Global toast viewport plus a reusable inline {@link ErrorAlert} for forms.
 * Mount {@link ToastContainer} once near the app root (see `main.tsx`).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { subscribeToasts, type Toast } from './toastStore';

/**
 * Fixed bottom toast stack driven by {@link subscribeToasts}.
 *
 * @returns `null` when there are no active toasts; otherwise the stacked viewport.
 * @remarks Side effect: subscribes to the toast store on mount and unsubscribes on unmount.
 */
export function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  // Bridge the module store into React state for rendering.
  useEffect(() => subscribeToasts(setItems), []);

  // Avoid mounting an empty fixed region when nothing is visible.
  if (items.length === 0) return null;

  const colors = {
    success: 'bg-[var(--color-success)]',
    error: 'bg-[var(--color-danger)]',
    info: 'bg-[var(--color-ink)]',
  };

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:inset-x-auto sm:right-4 sm:left-auto sm:max-w-sm">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto animate-lux-rise break-words rounded-xl px-4 py-3 text-sm text-white shadow-[var(--shadow-lift)] ${colors[t.type]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

/**
 * Inline error banner for forms (not a floating toast).
 *
 * @param props.message - Primary error text.
 * @param props.children - Optional extra content (retry links, field hints).
 */
export function ErrorAlert({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-900">
      <p className="font-medium">{message}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
