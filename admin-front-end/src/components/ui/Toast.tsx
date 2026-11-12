/**
 * Toast viewport subscribed to the module-level toast store.
 */
import { useEffect, useState, type ReactNode } from 'react';
// Import named exports from './toastStore'.
import { subscribeToasts, type Toast } from './toastStore';

/**
 * Fixed bottom-right stack of active toasts from {@link subscribeToasts}.
 * Renders nothing when the queue is empty.
 */
export function ToastContainer() {
  // Destructure array values into local variables.
  const [items, setItems] = useState<Toast[]>([]);

  // Keep local state in sync with the module store for the lifetime of the mount.
  useEffect(() => subscribeToasts(setItems), []);

  // Evaluate the condition and enter the branch when it is true.
  if (items.length === 0) return null;

  // Create the colors constant.
  const colors = {
    // Provide the success field value.
    success: 'bg-[var(--color-success)]',
    // Provide the error field value.
    error: 'bg-[var(--color-danger)]',
    // Provide the info field value.
    info: 'bg-[var(--color-ink)]',
  };

  // Return control to the caller with the following value.
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`animate-lux-rise rounded-xl px-4 py-3 text-sm text-white shadow-[var(--shadow-lift)] ${colors[t.type]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

/**
 * Inline error banner for form/page failure states.
 * @param message - Primary error text
 * @param children - Optional secondary actions/details below the message
 */
export function ErrorAlert({ message, children }: { message: string; children?: ReactNode }) {
  // Return control to the caller with the following value.
  return (
    <div className="rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-900">
      <p className="font-medium">{message}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
