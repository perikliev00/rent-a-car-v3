/**
 * Simple surface card container used by admin list/detail pages.
 */
import type { ReactNode } from 'react';

/**
 * Bordered elevated surface wrapping page sections.
 * @param children - Card content
 * @param className - Optional extra classes on the outer shell
 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-[var(--shadow-soft)] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Card title row with a bottom divider.
 * @param children - Header content
 * @param className - Optional extra classes
 */
export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border-b border-[var(--color-line)] px-4 py-4 sm:px-6 ${className}`}>{children}</div>
  );
}

/**
 * Padded card body region.
 * @param children - Body content
 * @param className - Optional extra classes
 */
export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 px-4 py-5 sm:px-6 ${className}`}>{children}</div>;
}
