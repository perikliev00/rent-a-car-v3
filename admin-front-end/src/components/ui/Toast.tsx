import { useEffect, useState, type ReactNode } from 'react';
import { subscribeToasts, type Toast } from './toastStore';

export function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  const colors = {
    success: 'bg-[var(--color-success)]',
    error: 'bg-[var(--color-danger)]',
    info: 'bg-[var(--color-ink)]',
  };

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

export function ErrorAlert({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-900">
      <p className="font-medium">{message}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
