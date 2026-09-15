import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-[var(--shadow-soft)] ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-b border-[var(--color-line)] px-4 py-4 sm:px-6 ${className}`}>{children}</div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 px-4 py-5 sm:px-6 ${className}`}>{children}</div>;
}
